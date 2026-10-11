import http from 'http';
import { io as Client } from 'socket.io-client';
import app from '../src/app.js';
import connectDB from '../src/config/db.js';
import { initSocket } from '../src/sockets/socket.js';
import User from '../src/models/User.js';
import mongoose from 'mongoose';

const runTests = async () => {
  console.log('--- Starting ProxiSpeak Commit 2 Test Suite ---');
  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`✅ [PASS] ${description}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${description}`);
      failedCount++;
    }
  };

  // Connect to DB
  await connectDB();

  // Clean up any test users from DB
  await User.deleteMany({ username: { $in: ['TestAlice', 'TestBob'] } });

  // 1. Start Server on ephemeral/test port
  const server = http.createServer(app);
  const ioServer = initSocket(server);
  const TEST_PORT = 5055;

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  assert(true, '1. Backend server started successfully on port ' + TEST_PORT);

  // 2. Test GET /health
  try {
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
    const healthJson = await healthRes.json();
    assert(
      healthRes.status === 200 && healthJson.status === 'ok',
      '2. GET /health endpoint returns HTTP 200 status ok'
    );
  } catch (err) {
    assert(false, `2. GET /health failed: ${err.message}`);
  }

  // Helper to create client
  const createClient = () => {
    return Client(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });
  };

  const client1 = createClient();
  const client2 = createClient();

  // 3. Connect two clients
  await Promise.all([
    new Promise((resolve) => client1.on('connect', resolve)),
    new Promise((resolve) => client2.on('connect', resolve)),
  ]);
  assert(
    client1.connected && client2.connected,
    '3. Two Socket.io clients connected concurrently'
  );

  // 4. Client 1 joins
  const client1JoinedPromise = new Promise((resolve) => {
    client1.on('avatar:joined', resolve);
  });
  const client1InitialPromise = new Promise((resolve) => {
    client1.on('avatars:initial', resolve);
  });

  client1.emit('avatar:join', { username: 'TestAlice', x: 50, y: 50 });

  const c1JoinedData = await client1JoinedPromise;
  const c1InitialData = await client1InitialPromise;

  assert(
    c1JoinedData.username === 'TestAlice' && c1JoinedData.x === 50 && c1JoinedData.y === 50,
    '5a. Client 1 receives avatar:joined confirmation with valid coordinates'
  );
  assert(
    Array.isArray(c1InitialData) && c1InitialData.length === 1 && c1InitialData[0].username === 'TestAlice',
    '4a. Client 1 receives avatars:initial list'
  );

  // Client 2 joins and verifies receiving current avatar list and Client 1 receiving Client 2's avatar:joined
  const client2JoinedPromise = new Promise((resolve) => {
    client2.on('avatar:joined', resolve);
  });
  const client2InitialPromise = new Promise((resolve) => {
    client2.on('avatars:initial', resolve);
  });
  const client1NotifiedPromise = new Promise((resolve) => {
    client1.on('avatar:joined', resolve);
  });

  client2.emit('avatar:join', { username: 'TestBob', x: 70, y: 80 });

  const c2JoinedData = await client2JoinedPromise;
  const c2InitialData = await client2InitialPromise;
  const c1NotifiedData = await client1NotifiedPromise;

  assert(
    Array.isArray(c2InitialData) &&
      c2InitialData.some((a) => a.username === 'TestAlice') &&
      c2InitialData.some((a) => a.username === 'TestBob'),
    '4b. Newly joined Client 2 receives active avatars list including TestAlice and TestBob'
  );
  assert(
    c1NotifiedData.username === 'TestBob' && c1NotifiedData.x === 70,
    '4c. Existing Client 1 receives avatar:joined broadcast for newcomer TestBob'
  );

  // 5 & 6. Test movement and broadcasting to other clients
  const client2MovedPromise = new Promise((resolve) => {
    client2.on('avatar:moved', resolve);
  });

  let client1ReceivedOwnMove = false;
  client1.on('avatar:moved', (data) => {
    if (data.username === 'TestAlice') {
      client1ReceivedOwnMove = true;
    }
  });

  client1.emit('avatar:move', { x: 75, y: 85 });

  const c2MovedData = await client2MovedPromise;
  assert(
    c2MovedData.username === 'TestAlice' && c2MovedData.x === 75 && c2MovedData.y === 85,
    '6. Other client (Client 2) receives avatar:moved event with updated coordinates'
  );
  assert(
    !client1ReceivedOwnMove,
    '5b. Movement updates are not broadcast back to originating socket (Client 1)'
  );

  // 7. Test invalid coordinates rejection
  const invalidErrorPromise = new Promise((resolve) => {
    client1.on('error', resolve);
  });
  client1.emit('avatar:move', { x: 'invalid_coord', y: null });
  const errorData = await invalidErrorPromise;
  assert(
    errorData && errorData.message.includes('Invalid coordinates'),
    '7. Invalid coordinates are rejected safely without crashing the server'
  );

  // Give DB a moment to flush async save
  await new Promise((r) => setTimeout(r, 200));

  // 9. Verify MongoDB records without duplicate documents
  const aliceDocs = await User.find({ username: 'TestAlice' });
  assert(
    aliceDocs.length === 1,
    '9a. MongoDB has exactly 1 document for TestAlice (no duplicates created on movement)'
  );
  assert(
    aliceDocs[0].location.coordinates[0] === 75 && aliceDocs[0].location.coordinates[1] === 85,
    '9b. MongoDB coordinates persisted accurately: [75, 85]'
  );

  // 8. Test disconnection and avatar:left emission
  const client2LeftPromise = new Promise((resolve) => {
    client2.on('avatar:left', resolve);
  });

  client1.disconnect();

  const c2LeftData = await client2LeftPromise;
  assert(
    c2LeftData.username === 'TestAlice',
    '8a. Remaining client receives avatar:left event when Client 1 disconnects'
  );

  // Verify MongoDB updated isOnline status
  await new Promise((r) => setTimeout(r, 200));
  const aliceAfterDisconnect = await User.findOne({ username: 'TestAlice' });
  assert(
    aliceAfterDisconnect && aliceAfterDisconnect.isOnline === false,
    '8b. MongoDB user status updated to isOnline: false after disconnect'
  );

  // Clean up
  client2.disconnect();
  await new Promise((r) => setTimeout(r, 150));
  await User.deleteMany({ username: { $in: ['TestAlice', 'TestBob'] } });
  server.close();
  await mongoose.disconnect();

  console.log('--- Test Suite Summary ---');
  console.log(`Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount === 0) {
    console.log('🎉 ALL CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME CHECKS FAILED!');
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
