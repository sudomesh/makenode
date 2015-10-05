

module.exports = function(u, hwInfo, callback) {

  // this config is only for TP-Link WDR4300 WDR3600 and WDR3500
  if(hwInfo.model != 'TP-LINK TL-WDR3500') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password"),
      streams_2g: 2,
      streams_5g: 2,
      wan_interface: 'eth1',
  };


  callback(null, conf);
};
