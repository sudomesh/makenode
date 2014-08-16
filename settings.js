
module.exports = {

    // router IP
    ip: '192.168.1.1',
    port: '22',

    // The root password for the newly configured routers
    rootPassword: 'meshtheplanet',

    // settings for connection to the meshnode-database
    // https://github.com/sudomesh/meshnode-database
    nodeDB: {
        url: 'http://localhost:3000',
        username: 'deployer',
        password: 'praisebob'
    },

    // where templates are staged before compilation
    templateStageDir: 'templateStaging',

    // where final files are staged before being packaged into an ipk
    stageDir: 'staging',

    // where ipks are saved
    ipkDir: 'ipks',

    // maintainer for generated ipk files
    ipkMaintainer: "sudo mesh <info@sudomesh.org>"

};
