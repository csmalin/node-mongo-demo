const SECRETS = require('./secrets.json');
var chalk = require('chalk');

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  var logGreen= function(msg){shipit.log(chalk.green(msg))};

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

  shipit.task('install', function(){
    shipit.start('systemUpdate');

    shipit.on('systemUpdated', function(){
      shipit.start('startupScript');
    });

    shipit.on('startupScriptInstalled', function(){
      shipit.start('installNode');
    });

    shipit.on('nodeInstalled', function(){
      shipit.start('installForever');
    });

    shipit.on('foreverInstalled', function(){
      shipit.start('installMongo');
    });

    shipit.on('mongoInstalled', function(){
      shipit.start('deploy');
    });
  });

  shipit.task('refresh', function(){
    logGreen('Starting Refresh');
    logGreen('Stopping the Server');
    shipit.remote('/usr/bin/sudo -u ubuntu /usr/bin/forever stopall').then(function(){
      logGreen('Running npm-install');
      shipit.remote('cd /home/ubuntu/node-mongo-demo/current && npm install').then(function(){
          logGreen('Restarting the server');
         shipit.remote('/usr/bin/sudo -u ubuntu /usr/bin/forever start /home/ubuntu/node-mongo-demo/current/bin/www');
      });
    });
  });

  shipit.task('systemUpdate', function(){
    logGreen('Running apt-get update');
    shipit.remote('sudo apt-get update').then(function(){
      logGreen('running dist-upgrade');
      shipit.remote('sudo apt-get dist-upgrade -y').then(function(){
        logGreen('Finished upgrades');
        shipit.emit('systemUpdated')
      });
    });
  });

  shipit.task('startupScript', function(){
    logGreen("Installing Startup Script");
    shipit.remoteCopy('./node_server_init.sh', `/home/${SECRETS.appUser}/node_server_init.sh`).then(function(){
      shipit.remote(`echo "@reboot /bin/sh /home/${SECRETS.appUser}/node_server_init.sh" > server_crontab && crontab server_crontab`).then(function(){
        shipit.remote(`chmod 700 /home/${SECRETS.appUser}/node_server_init.sh`).next(function(){
          shipit.remote(`rm /home/${SECRETS.appUser}/server_crontab`).next(function(){
            shipit.emit('startupScriptInstalled');
          });
        });
      });
    });
  });

  shipit.task('installNode', function(){
    logGreen('Installing Node.js');
    shipit.remote('curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -').next(function(){
      shipit.remote('sudo apt-get install -y nodejs').next(function(){
        shipit.emit('nodeInstalled');
      });
    });
  });

  shipit.task('installForever', function(){
    logGreen('Installing Forever');
    shipit.remote('npm install forever -g').next(function(){
      shipit.emit('foreverInstalled');
    });
  });

  shipit.task('installMongo', function(){
    logGreen('Installing MongoDB');
    shipit.remote('sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10').next(function(){
      shipit.remote('echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list').next(function(){
        shipit.remote('sudo apt-get update').next(function(){
          shipit.remote('sudo apt-get install -y mongodb-org libkrb5-dev').next(function(){
            shipit.remote('sudo service mongod start').next(function(){
              shipit.emit('mongoInstalled');
            });
          });
        });
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
