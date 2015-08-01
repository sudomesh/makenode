

module.exports = function(u, hwInfo, callback) {

  if(hwInfo.model.indexOf('TP-LINK') === -1 || hwInfo.model.indexOf('4300') === -1) {
    return callback(null, null);
  }



  var conf = {
      macAddr: u.macAddr(hwInfo),
      private_wifi_ssid: u.askUser("Enter desired private wifi SSID"),
      private_wifi_key: u.askUser("Enter desired private wifi password")
  };


  callback(null, conf);
};
