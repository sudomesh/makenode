

module.exports = function(u, hwInfo, callback) {

  // this config is only for Western Digital My Net N600 and N750 routers
  if(hwInfo.model != 'WD My Net N750' &&
     hwInfo.model != 'WD My Net N600') {
    return callback(null, null);
  }

  var conf = {
      macAddr: u.macAddr(hwInfo),
      streams_2g: 2,
      streams_5g: 2,
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };

  if(hwInfo.model === 'WD My Net N750') {
    conf.wan_interface = 'eth0.5';
    conf.streams_5g = 3;
  } else if (hwInfo.model === 'WD My Net N600') {
    conf.streams_5g = 2;
    conf.wan_interface = 'eth1';
  }

  callback(null, conf);
};
