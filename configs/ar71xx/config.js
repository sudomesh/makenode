

module.exports = function(hwInfo) {

  if(hwInfo.chipset != 'ar71xx') {
    return null;
  }

  var conf = {
    foo: 'bar'
  };

        

  return conf;
    
};
