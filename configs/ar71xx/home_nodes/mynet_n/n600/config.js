

module.exports = function(u, hwInfo, callback) {

  // this config is only for Western Digital My Net N600 
  if(hwInfo.model != 'WD My Net N600') {
    return callback(null, null);
  }

  var conf = {
      streams_2g: 2,
      streams_5g: 2,
  };

  callback(null, conf);
};
