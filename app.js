window.addEventListener("load", function() {
  console.log("Hello Heart Rate!");

//  var targetDeviceAddress = "01:23:45:67:89:ab";
//  var targetDeviceName = "myPeripheral";
//  var targetDeviceAddress = "cf:8f:d6:7c:ba:c1";
//  var targetDeviceName = "Wahoo HRM V1.7";
  var targetDeviceAddress = "01:23:45:67:89:ab";
  var targetDeviceName = "MIO GLOBAL";

  var manager = window.navigator.mozBluetooth;
  var discoveryHandle = null;

  var HRM_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
  var HRM_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
  var CCCD_UUID = '00002902-0000-1000-8000-00805f9b34fb';

  // make sure the default adapter is ready at the content side
  manager.onattributechanged = function OnManagerAttributeChanged(evt) {
    for (var i in evt.attrs) {
      switch (evt.attrs[i]) {
        case 'defaultAdapter':
          console.log("defaultAdapter changed. address:", manager.defaultAdapter.address);
          searchLeDevice(manager.defaultAdapter);
          break;
        default:
          break;
      }
    }
  }

  // search for the target device
  searchLeDevice = function SearchLeDevice(adapter) {
    if (adapter && adapter.state === 'enabled') {
      adapter.startLeScan([]).then(function onResolve(handle) {
        discoveryHandler = handle;
        discoveryHandler.ondevicefound = function onDeviceFound(evt) {
          var device = evt.device;
          if (device.address === targetDeviceAddress || device.name === targetDeviceName) {
            adapter.stopLeScan(discoveryHandler);
            connectLeDevice(device);
          }
        }
      });
    }
  }

  // connect to the target device
  connectLeDevice = function ConnectLeDevice(device) {
    if (device.gatt) {
      device.gatt.connect().then(function onResolve() {
        device.gatt.discoverServices().then(function onResolve() {
          console.log('discoverServices done!');
          subscribeNotification(device.gatt);
        }, function onReject(reason) {
          console.log('discoverServices failed: ' + reason);
        });
      }, function onReject(reason) {
        console.log('connect failed: ' + reason);
      });
    }
  }

  // subscribe notification
  subscribeNotification = function SubscribeNotification(gattClient) {
    var hrmChar = null;

    for (var i in gattClient.services) {
      if (gattClient.services[i].uuid === HRM_SERVICE_UUID) {
        for (var j in gattClient.services[i].characteristics) {
          if (gattClient.services[i].characteristics[j].uuid === HRM_CHARACTERISTIC_UUID) {
            // Found heart reate measurement characteristic
            hrmChar = gattClient.services[i].characteristics[j];
    
            // Call startNotifications to register notifications from the local BT stack
            hrmChar.startNotifications().then(function onResolve() {
              console.log('start notification completed');
            }, function onReject(reason) {
              console.log('start notifications failed: ' + reason);
            });
    
            // Write CCCD to subscribe notifications from the remote BLE server
            for (var i in hrmChar.descriptors) {
              if (hrmChar.descriptors[i].uuid === CCCD_UUID) {
                cccDescriptor = hrmChar.descriptors[i];
                var arrayBuffer = new ArrayBuffer(2);
                var uint8Array = new Uint8Array(arrayBuffer);
                uint8Array[0] = 0x01; // Notification
                uint8Array[1] = 0x00; // Indication
                cccDescriptor.writeValue(arrayBuffer).then(function onResolve() {
                  console.log('write descriptor completed');
                }, function onReject(reason) {
                  console.log('write descriptor failed: ' + reason);
                })
              }
            }
          }
        }
      }
    }
    
    // handle the change of the characteristic
    gattClient.oncharacteristicchanged = function OnCharacteristicChanged(evt) {
      var characteristic = evt.characteristic;
      console.log('Characteristic ' + characteristic.uuid + ' value changed');

      if (characteristic.uuid === HRM_CHARACTERISTIC_UUID) {
        // Parse the characteristic value
        var valueBytes = new Uint8Array(characteristic.value);
        var format = valueBytes[0] & 0x01;
        var heartRate = 0;
        if (format == 0) {
          console.log('8-bit Heart Rate format');
          heartRate = valueBytes[1];
          console.log('heart rate: ' + heartRate);
        } else {
          console.log('16-bit Heart Rate format');
          heartRate = valueBytes[1] | (valueBytes[2] << 8);
          console.log('heart rate: ' + heartRate);
        }
        window.document.getElementById("heart_rate").textContent = heartRate;
        window.document.getElementById("update_time").textContent = (new Date()).toString();
      }
    };
  }
});
