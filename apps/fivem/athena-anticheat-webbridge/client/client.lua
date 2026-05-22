RegisterNetEvent('athena:web:freeze',function()
 local ped=PlayerPedId()
 FreezeEntityPosition(ped, not IsEntityPositionFrozen(ped))
end)

RegisterNetEvent('athena:web:requestScreen',function(actionId)
 -- For real screenshots install screenshot-basic and replace placeholder with requestScreenshotUpload.
 -- exports['screenshot-basic']:requestScreenshot(function(data)
 --   TriggerServerEvent('athena:web:screenResult', actionId, data)
 -- end)
 TriggerServerEvent('athena:web:screenResult', actionId, 'https://placehold.co/1280x720/06101f/16d8ff?text=INSTALL+screenshot-basic+FOR+REAL+SCREEN')
end)
