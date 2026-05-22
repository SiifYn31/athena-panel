# ATHENA SHIELD FINAL REAL PRODUCTION

This package is rebuilt around the exact checklist:

- Server Analytics real, not demo/fake
- Dashboard reads live players/resources/detections from FiveM bridge
- Live Ops buttons send actions to bridge
- Streams/Spectate base works through actions and stream endpoint
- Players page shows player info and actions
- Interactive map shows players by coords
- Ban Center has Ban ID, reason, evidence screen, revoke button
- Whitelist add/remove with design
- Configuration save works, webhook works, large detection toggle list
- Lookup searches players, bans, detections, whitelist, admins, logs, HWID, sessions, resources
- Admins add/delete with design
- Logs and console style
- HWID/IP center from identifiers
- Screenshots base + test screenshot
- Risk per player
- Resources start/stop/restart through bridge
- Download protected with code: 20060331
- ATHENA PVP logo installed

## Run
```bash
cp .env.example .env
npm run install:all
npm run dev:api
npm run dev:web
```

Open:
```txt
http://localhost:5173
```

Login:
```txt
admin@athena.local
admin123
```

## FiveM
Copy:
```txt
apps/fivem/athena-anticheat-webbridge
```
to resources and add:
```cfg
ensure athena-anticheat-webbridge
```

Set in bridge config:
```lua
Config.ApiUrl='http://YOUR_PANEL_IP:4010'
Config.ApiKey='ATHENA_DEMO_KEY_CHANGE_ME'
```

## Real screenshot/spectate
Install `screenshot-basic`, then edit:
```txt
apps/fivem/athena-anticheat-webbridge/client/client.lua
```
and enable the screenshot-basic lines.
