var express = require('express');
var router = express.Router();

var mongoose = require('mongoose');
var User = require('../models/User.js');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/userlist', function(req, res) {
  User.find(function (err, users) { 
    console.log(users);
    res.render('userlist', { "userlist": users });
  });
});

module.exports = router;
