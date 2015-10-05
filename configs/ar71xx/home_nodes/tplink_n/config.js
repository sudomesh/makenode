

module.exports = function(u, hwInfo, callback) {

  // this config is only for TP-Link WDR4300 WDR3600 and WDR3500
  if((hwInfo.model.indexOf('TP-LINK') === -1 || 
      hwInfo.model.indexOf('4300') === -1 ) &&
      hwInfo.model != 'TP-LINK TL-WDR3500') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password"),
      streams_2g: 2,
      streams_5g: 3,
  };

  if(hwInfo.model === 'TP-LINK TL-WDR3500') {
    conf.streams_5g = 2;
  }

  callback(null, conf);
};
