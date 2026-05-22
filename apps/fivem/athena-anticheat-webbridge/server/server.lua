local function post(path,payload,cb)
 PerformHttpRequest(Config.ApiUrl..path,function(code,body) if cb then cb(code,body) end if code<200 or code>=300 then print('[ATHENA] HTTP '..code..' '..(body or '')) end end,'POST',json.encode(payload),{['Content-Type']='application/json',['x-athena-key']=Config.ApiKey})
end
local function get(path,cb) PerformHttpRequest(Config.ApiUrl..path,function(code,body) if cb then cb(code,body) end end,'GET','',{['x-athena-key']=Config.ApiKey}) end
local function players()
 local t={}
 for _,id in ipairs(GetPlayers()) do
  local ped=GetPlayerPed(id); local c=ped and ped~=0 and GetEntityCoords(ped) or nil
  t[#t+1]={id=tonumber(id),name=GetPlayerName(id),ping=GetPlayerPing(id),identifiers=GetPlayerIdentifiers(id),coords=c and {x=c.x,y=c.y,z=c.z} or nil,online=true}
 end
 return t
end
local function resources()
 local t={}
 for i=0,GetNumResources()-1 do local n=GetResourceByFindIndex(i); if n then t[#t+1]={name=n,state=GetResourceState(n)} end end
 return t
end
exports('SendDetection',function(src,reason,details,autoBan,screen)
 local ids=GetPlayerIdentifiers(src); local ped=GetPlayerPed(src); local c=ped and ped~=0 and GetEntityCoords(ped) or nil
 post('/api/bridge/detection',{serverId=Config.ServerId,source=src,playerId=src,playerName=GetPlayerName(src),reason=reason,details=details,identifiers=ids,coords=c and {x=c.x,y=c.y,z=c.z} or nil,autoBan=autoBan~=false,screen=screen})
end)
RegisterNetEvent('athena:web:detection',function(reason,details,autoBan,screen) exports['athena-anticheat-webbridge']:SendDetection(source,reason,details,autoBan,screen) end)
CreateThread(function()
 while true do
  post('/api/bridge/snapshot',{serverId=Config.ServerId,hostname=GetConvar('sv_hostname','ATHENA PVP'),maxClients=GetConvarInt('sv_maxclients',0),players=players(),resources=resources(),metrics={cpu=0,ram=0}})
  Wait(Config.PushEvery or 10000)
 end
end)
CreateThread(function()
 while true do
  get('/api/actions/pending',function(code,body)
   if code==200 and body then
    local ok,actions=pcall(json.decode,body)
    if ok then
     for _,a in ipairs(actions) do
      if a.type=='resource.start' then ExecuteCommand('ensure '..a.resource)
      elseif a.type=='resource.stop' then ExecuteCommand('stop '..a.resource)
      elseif a.type=='resource.restart' then ExecuteCommand('restart '..a.resource)
      elseif a.type=='player.kick' and a.playerId then DropPlayer(tonumber(a.playerId),'ATHENA kick')
      elseif a.type=='player.screenshot' and a.playerId then TriggerClientEvent('athena:web:requestScreen',tonumber(a.playerId),a.id)
      elseif a.type=='player.freeze' and a.playerId then TriggerClientEvent('athena:web:freeze',tonumber(a.playerId))
      elseif a.type=='player.spectate' and a.playerId then TriggerClientEvent('athena:web:requestScreen',tonumber(a.playerId),a.id)
      elseif a.type=='player.ban' and a.playerId then exports['athena-anticheat-webbridge']:SendDetection(tonumber(a.playerId),'manual_dashboard_ban','Admin action',true)
      end
      post('/api/actions/'..a.id..'/done',{ok=true})
     end
    end
   end
  end)
  Wait(3000)
 end
end)
RegisterNetEvent('athena:web:screenResult',function(actionId,image)
 local src=source
 local ped=GetPlayerPed(src); local c=ped and ped~=0 and GetEntityCoords(ped) or nil
 post('/api/bridge/stream',{source=src,playerId=src,playerName=GetPlayerName(src),image=image,coords=c and {x=c.x,y=c.y,z=c.z} or nil})
end)
print('^2[ATHENA WEBBRIDGE FINAL]^7 loaded')
