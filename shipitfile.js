const SECRETS = require('./secrets.json');
var chalk = require('chalk');

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  var servers = [];

  SECRETS.servers.forEach(function(server){
    servers.push(`${SECRETS.appUser}@${server}`);
  });

  shipit.initConfig({
    default: {
      workspace: '/tmp/node-mongo-demo',
      deployTo: `/home/${SECRETS.appUser}/node-mongo-demo`,
      repositoryUrl: 'git@github.com:csmalin/node-mongo-demo.git',
      ignores: ['.git', 'node_modules'],
      rsync: ['--del'],
      keepReleases: 2,
      key: SECRETS.sshKeyLocation,
      shallowClone: true
    },
    production: {
      servers: servers
    }
  });

  shipit.task('refresh', function(){
    shipit.log(chalk.green('Starting Refresh'));
    shipit.log(chalk.green('Stopping the Server'));
    shipit.remote('/usr/bin/sudo -u ubuntu /usr/bin/forever stopall').then(function(){
      shipit.log(chalk.green('Running npm-install'));
      shipit.remote('cd /home/ubuntu/node-mongo-demo/current && npm install').then(function(){
          shipit.log(chalk.green('Restarting the server'));
         shipit.remote('/usr/bin/sudo -u ubuntu /usr/bin/forever start /home/ubuntu/node-mongo-demo/current/bin/www');
      });
    });
  });

  shipit.task('dist-upgrade', function(){
    shipit.log(chalk.green('Updating apt-get repos'));
    shipit.remote('sudo apt-get update').then(function(){
      shipit.log(chalk.green('running dist-upgrade'));
      shipit.remote('sudo apt-get dist-upgrade -y').then(function(){
        shipit.log(chalk.green('Finished upgrades'));
      });
    });
  });

  shipit.on('cleaned', function(){
    return shipit.start('refresh');
  });

  shipit.on('rollback', function(){
    return shipit.start('refresh');
  });
};
