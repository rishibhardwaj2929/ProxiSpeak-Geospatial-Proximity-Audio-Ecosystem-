import {io} from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

export const socket = io(SERVER_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

export function connectSocket(){
    if(!socket.connected){
        socket.connect();
    }
}

export function disconnectSocket(){
    if(socket.connected){
        socket.disconnect();
    }
}