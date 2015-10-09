

module.exports = function(u, hwInfo, callback) {

  // this config is only for TP-Link Archer C7 (v2)
  if(hwInfo.model !== 'TP-LINK Archer C7') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password"),
      streams_2g: 3,
      streams_5g: 3,
      wan_interface: 'eth0.1'
  };

  callback(null, conf);
};
