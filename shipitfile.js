const SECRETS = require('./secrets.json');

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  shipit.initConfig({
    default: {
      workspace: '/tmp/node-mongo-demo',
      deployTo: '/home/ubuntu/node-mongo-demo',
      repositoryUrl: 'git@github.com:csmalin/node-mongo-demo.git',
      ignores: ['.git', 'node_modules'],
      rsync: ['--del'],
      keepReleases: 2,
      key: SECRETS.server.sshKeyLocation,
      shallowClone: true
    },
    production: {
      servers: `${SECRETS.server.user}@${SECRETS.server.address}`
    }
  });

  shipit.task('stopAll', function(){
    return shipit.remote('/usr/bin/sudo -u ubuntu /usr/bin/forever stopall').then(function(){
      shipit.emit('stopped');
    });
  });

  shipit.task('start', function(){
    return shipit.remote('/usr/bin/sudo -u ubuntu /usr/bin/forever start /home/ubuntu/node-mongo-demo/current/bin/www').then(function(){
      shipit.emit('started');
    });
  });

  shipit.task('restart', function(){
    shipit.start('stopAll');
    shipit.on('stopped', function(){ shipit.start('start'); });
  });

  shipit.task('npmInstall', function(){
    return shipit.remote('cd /home/ubuntu/node-mongo-demo/current && npm install').then(function(){
      shipit.emit('npmInstalled');
    });
  });

  shipit.on('deploy', function(){
    return shipit.start('npmInstall');
  });

  shipit.on('rollbacked', function(){
    return shipit.start('npmInstall');
  });

  shipit.on('npmInstalled', function(){
    return shipit.start('restart');
  });
};
