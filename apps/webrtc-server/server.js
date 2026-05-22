const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 4020 });

const peers = new Map();

wss.on("connection", (ws) => {

    ws.on("message", (msg) => {

        try {
            const data = JSON.parse(msg);

            if (data.type === "register") {
                peers.set(data.id, ws);
                ws.peerId = data.id;

                console.log("[ATHENA WEBRTC] registered:", data.id);
                return;
            }

            if (data.to && peers.has(data.to)) {
                peers.get(data.to).send(JSON.stringify({
                    ...data,
                    from: ws.peerId
                }));
            }

        } catch (e) {
            console.log(e);
        }

    });

    ws.on("close", () => {
        if (ws.peerId) {
            peers.delete(ws.peerId);
            console.log("[ATHENA WEBRTC] disconnected:", ws.peerId);
        }
    });

});

console.log("ATHENA WebRTC signaling server on :4020");