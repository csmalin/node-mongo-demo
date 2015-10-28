const SECRETS = require('./secrets.json');
const APP_USER = 'node_user';
const APP_NAME = 'node-mongo-demo';
var chalk = require('chalk');

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  var logGreen = function(msg){shipit.log(chalk.green(msg))};

  var servers = [];

  SECRETS.servers.forEach(function(server){
    servers.push(`ubuntu@${server}`);
  });

  shipit.initConfig({
    default: {
      workspace: '/tmp/node-mongo-demo',
      deployTo: `/opt/${APP_NAME}`,
      repositoryUrl: 'git@github.com:csmalin/node-mongo-demo.git',
      ignores: ['.git', 'node_modules'],
      rsync: ['--del'],
      keepReleases: 2,
      key: './ec2-ubuntu-node.pem',
      shallowClone: true
    },
    production: {
      servers: servers
    },
  });

  shipit.task('install', function(){
    shipit.start('systemUpdate');

    shipit.on('systemUpdated', function(){
      shipit.start('createAppUser');
    });

    shipit.on('appUserCreated', function(){
      shipit.start('initProjectFolder');
    });

    shipit.on('projectFolderInitialized', function(){
      shipit.start('setupAutorunOnReboot');
    });

    shipit.on('autorunOnRebootSetupComplete', function(){
      shipit.start('installNode');
    });

    shipit.on('nodeInstalled', function(){
      shipit.start('installPassenger');
    });

    shipit.on('passengerInstalled', function(){
      shipit.start('installMongo');
    });

    shipit.on('mongoInstalled', function(){
      shipit.start('deploy');
    });
  });

  shipit.task('refresh', function(){
    logGreen('Starting Refresh');
    logGreen('Stopping Passenger');
    shipit.remote(`sudo -H -u ${APP_USER} bash -c "/usr/bin/passenger stop || echo 'Passenger already stopped, continuing...'"`).then(function(){
      logGreen('Setting Folder Permissions');
      shipit.remote(`sudo chown -R ${APP_USER}:netdev /opt/${APP_NAME}`).then(function(){
        logGreen('Running npm-install');
        shipit.remote(`sudo -H -u ${APP_USER} bash -c "cd /opt/${APP_NAME}/current && npm install --production"`).then(function(){
          logGreen('Restarting Passenger');
          shipit.remote(`sudo -H -u ${APP_USER} bash -c "cd /opt/${APP_NAME} && /usr/bin/passenger-config restart-app /"`);
        });
      });
    });
  });

  shipit.task('createAppUser', function(){
    logGreen(`Creating user: ${APP_USER}`);
    shipit.remote(`id -u ${APP_USER} &> /dev/null || sudo adduser --disabled-password --gecos "" ${APP_USER}`).then(function(){
      shipit.remote(`sudo mkdir -p ~${APP_USER}/.ssh`).then(function(){
        shipit.remote(`sudo sh -c "cat /home/ubuntu/.ssh/authorized_keys >> ~${APP_USER}/.ssh/authorized_keys"`).then(function(){
          shipit.remote(`sudo chown -R ${APP_USER}: ~${APP_USER}/.ssh`).then(function(){
            shipit.remote(`sudo chmod 700 ~${APP_USER}/.ssh`).then(function(){
              shipit.remote(`sudo sh -c "chmod 600 ~${APP_USER}/.ssh/*"`).then(function(){
                shipit.remote(`sudo usermod -a -G netdev ${APP_USER}`).then(function(){
                  shipit.emit('appUserCreated');
                  logGreen(`user(${APP_USER}) created, now run production install`);
                });
              });
            });
          });
        });
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

  shipit.task('setupAutorunOnReboot', function(){
    shipit.remote("sudo sh -c \"echo \\\"sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000\\\" >> /etc/init.d/rc.local\"").then(function(){
      shipit.remote(`sudo sh -c 'echo \"sudo -H -u ${APP_USER} bash -c \\\\\"/usr/bin/passenger start --app-type node --startup-file /opt/${APP_NAME}/current/bin/www -d\\\\\" \" >> /etc/init.d/rc.local'`).then(function(){
        shipit.emit('autorunOnRebootSetupComplete');
      })
    });
  });

  shipit.task('initProjectFolder', function(){
    shipit.remote(`sudo mkdir -p /opt/${APP_NAME} && sudo chown ${APP_USER}:netdev /opt/${APP_NAME} && sudo chmod 775 /opt/${APP_NAME}`).then(function(){
      shipit.emit('projectFolderInitialized');
    });
  })

  shipit.task('installNode', function(){
    logGreen('Installing Node.js');
    shipit.remote('curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -').then(function(){
      shipit.remote('sudo apt-get install -y nodejs').then(function(){
        shipit.emit('nodeInstalled');
      });
    });
  });

  shipit.task('installPassenger', function(){
    logGreen('Installing Phusion Passenger');
    shipit.remote('sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 561F9B9CAC40B2F7').then(function(){
      shipit.remote('sudo apt-get install -y apt-transport-https ca-certificates').then(function(){
        shipit.remote("sudo sh -c 'echo deb https://oss-binaries.phusionpassenger.com/apt/passenger trusty main > /etc/apt/sources.list.d/passenger.list'").then(function(){
          shipit.remote('sudo apt-get update').then(function(){
            shipit.remote('sudo apt-get install -y passenger').then(function(){
              shipit.emit('passengerInstalled');
            });
          });
        });
      });
    });
  });

  shipit.task('installMongo', function(){
    logGreen('Installing MongoDB');
    shipit.remote('sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10').then(function(){
      shipit.remote('echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list').then(function(){
        shipit.remote('sudo apt-get update').then(function(){
          shipit.remote('sudo apt-get install -y mongodb-org libkrb5-dev').then(function(){
            shipit.remote('sudo service mongod restart').then(function(){
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
