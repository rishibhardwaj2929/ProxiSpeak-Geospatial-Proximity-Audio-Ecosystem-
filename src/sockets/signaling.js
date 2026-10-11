import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * In-memory registry for connected avatars:
 * Map<socketId, { socketId: string, avatarId: string, username: string, x: number, y: number, isOnline: boolean }>
 */
export const activeAvatars = new Map();

/**
 * Validates coordinate pair [x, y].
 *
 * @param {*} x
 * @param {*} y
 * @returns {boolean}
 */
export const areCoordinatesValid = (x, y) => {
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y);
};

/**
 * Registers Socket.io signaling & avatar movement handlers.
 *
 * @param {import('socket.io').Server} io
 */
export const registerSignalingHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected | Socket ID: ${socket.id}`);

    /**
     * Client -> Server: avatar:join
     * Payload: { username: string, x: number, y: number, avatarUrl?: string, avatarId?: string }
     */
    socket.on('avatar:join', async (payload) => {
      try {
        const username = (payload?.username || payload?.displayName || '').trim();
        const x = payload?.x;
        const y = payload?.y;

        // 1. Validation
        if (!username) {
          socket.emit('error', { message: 'Display name / username is required' });
          return;
        }

        if (!areCoordinatesValid(x, y)) {
          socket.emit('error', { message: 'Invalid coordinates: x and y must be finite numbers' });
          return;
        }

        // 2. Persist or update avatar record in MongoDB
        let user = null;
        try {
          if (payload?.avatarId && mongoose.isValidObjectId(payload.avatarId)) {
            user = await User.findById(payload.avatarId);
          }

          if (!user) {
            user = await User.findOne({ username });
          }

          if (user) {
            user.username = username;
            user.socketId = socket.id;
            user.isOnline = true;
            user.location = {
              type: 'Point',
              coordinates: [x, y],
            };
            if (payload?.avatarUrl) {
              user.avatarUrl = payload.avatarUrl;
            }
            await user.save();
          } else {
            user = await User.create({
              username,
              avatarUrl: payload?.avatarUrl || '',
              socketId: socket.id,
              isOnline: true,
              location: {
                type: 'Point',
                coordinates: [x, y],
              },
            });
          }
        } catch (dbError) {
          console.error(`[Avatar] MongoDB error on avatar:join for socket ${socket.id}:`, dbError.message);
        }

        const avatarId = user ? user._id.toString() : socket.id;

        const avatarData = {
          avatarId,
          username,
          x,
          y,
          isOnline: true,
        };

        // 3. Update in-memory mapping (socket.id -> avatar)
        activeAvatars.set(socket.id, avatarData);
        socket.data.avatar = avatarData;

        // 4. Send confirmation to joining client
        socket.emit('avatar:joined', avatarData);

        // 5. Send current list of active avatars to the newly joined client
        const currentActiveAvatars = Array.from(activeAvatars.values());
        socket.emit('avatars:initial', currentActiveAvatars);

        // 6. Notify all other connected clients about the new avatar
        socket.broadcast.emit('avatar:joined', avatarData);

        console.log(`[Avatar] Avatar joined: "${username}" (${avatarId}) at [${x}, ${y}]`);
      } catch (err) {
        console.error(`[Avatar] Unexpected error handling avatar:join:`, err.message);
        socket.emit('error', { message: 'Internal server error while joining' });
      }
    });

    /**
     * Client -> Server: avatar:move
     * Payload: { x: number, y: number }
     */
    socket.on('avatar:move', async (payload) => {
      try {
        const currentAvatar = activeAvatars.get(socket.id);
        if (!currentAvatar) {
          socket.emit('error', { message: 'Avatar has not joined yet' });
          return;
        }

        const { x, y } = payload || {};
        if (!areCoordinatesValid(x, y)) {
          socket.emit('error', { message: 'Invalid coordinates: x and y must be finite numbers' });
          return;
        }

        // Update in-memory state
        currentAvatar.x = x;
        currentAvatar.y = y;

        // Persist updated coordinates to MongoDB asynchronously
        try {
          if (mongoose.isValidObjectId(currentAvatar.avatarId)) {
            await User.findByIdAndUpdate(currentAvatar.avatarId, {
              'location.coordinates': [x, y],
            });
          }
        } catch (dbError) {
          console.error(`[Avatar] MongoDB error on avatar:move for avatarId ${currentAvatar.avatarId}:`, dbError.message);
        }

        // Broadcast updated position to all OTHER connected clients (exclude originating socket)
        const movePayload = {
          avatarId: currentAvatar.avatarId,
          username: currentAvatar.username,
          x,
          y,
        };

        socket.broadcast.emit('avatar:moved', movePayload);
      } catch (err) {
        console.error(`[Avatar] Unexpected error handling avatar:move:`, err.message);
        socket.emit('error', { message: 'Internal server error while moving' });
      }
    });

    /**
     * Socket disconnect handling
     */
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket.io] Client disconnected | Socket ID: ${socket.id} | Reason: ${reason}`);

      const avatar = activeAvatars.get(socket.id);
      if (avatar) {
        // Clean up in-memory registry
        activeAvatars.delete(socket.id);

        // Update persistence in MongoDB: mark offline and clear socketId
        try {
          if (mongoose.isValidObjectId(avatar.avatarId)) {
            await User.findByIdAndUpdate(avatar.avatarId, {
              isOnline: false,
              socketId: null,
            });
          }
        } catch (dbError) {
          console.error(`[Avatar] MongoDB error on avatar disconnect for avatarId ${avatar.avatarId}:`, dbError.message);
        }

        // Broadcast removal to remaining clients
        socket.broadcast.emit('avatar:left', {
          avatarId: avatar.avatarId,
          username: avatar.username,
        });

        console.log(`[Avatar] Avatar left: "${avatar.username}" (${avatar.avatarId})`);
      }
    });
  });
};
