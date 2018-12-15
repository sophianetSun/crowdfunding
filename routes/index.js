'use strict';

const express = require('express'),
  router = express.Router(),
  Web3 = require('web3'),
  fs = require('fs'),
  bodyParser = require('body-parser');

var urlencodedParser = bodyParser.urlencoded({ extended: false});

const ctkabi = require('../contracts/CustomTokenABI'),
  fundabi = require('../contracts/CrowdFundingABI');

const conAddr = "0x4d673b7d917878efd5f0d54e566543a912ab966e",
  fundAddr = "0xa831c12b2d7f78ac43fca4b0df9b83bc0e4ee4fc";
let ownAddr = "0xf8e2f0b12074a5ceaa5c1b8131d54d1b124eb9ff";

function initWeb3() {
  let web3;
  if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
  } else {
    // set the provider you want from Web3.providers
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8549"));
  }
  return web3;
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Croundfund app' });
});

router.get('/owner', function(req, res, next) {
  let web3 = initWeb3();

  var ctkContract = new web3.eth.Contract(ctkabi, conAddr);
  var fundContract = new web3.eth.Contract(fundabi, fundAddr);

  let initOwner = async () => {
    console.log('async start!');
    let ownETH = web3.utils.fromWei(await web3.eth.getBalance(ownAddr), 'ether');
    let fundETH = web3.utils.fromWei(await web3.eth.getBalance(fundAddr), 'ether');
    let goalETH = web3.utils.fromWei(await fundContract.methods.goalAmount().call(), 'ether');
    let conETH = await web3.eth.getBalance(conAddr);
    let conCTK = await ctkContract.methods.getBalance(conAddr).call();
    let isEnd = await fundContract.methods.ended().call();
    let fundStatus = isEnd == true? 'End': 'Ongoing';
    console.log('async end!');

    res.render('owner', {
      title: 'Owner',
      fundETH: fundETH,
      goalETH: goalETH,
      ownAddr: ownAddr,
      ownETH: ownETH,
      conAddr: conAddr,
      conETH: conETH,
      conCTK: conCTK,
      fundStatus: fundStatus,
    });
  };
  initOwner();
});

router.get('/owner/withdraw', function(req, res, next) {
  let web3 = initWeb3();
  var fundContract = new web3.eth.Contract(fundabi, fundAddr);

  let withdraw = async () => {
    await web3.eth.personal.unlockAccount(ownAddr, 'Owner');
    await fundContract.methods.withdraw().send({
      from: ownAddr
    }).then(console.log);
    res.redirect('/owner');
  };

  withdraw();
});

router.get('/owner/status', function(req, res, next) {
  let web3 = initWeb3();
  var fundContract = new web3.eth.Contract(fundabi, fundAddr);

  fundContract.methods.checkGoalReached().send({
    from: ownAddr
  }).then(res.redirect());
});

router.get('/investor', function(req, res, next) {
  let web3 = initWeb3();
  var ctkContract = new web3.eth.Contract(ctkabi, conAddr);
  var fundContract = new web3.eth.Contract(fundabi, fundAddr);
  let usrAddr = '';
  if (req.query.userAddress) usrAddr = req.query.userAddress;

  let initInvestor = async () => {
    let fundETH = web3.utils.fromWei(await web3.eth.getBalance(fundAddr), 'ether');
    let goalETH = web3.utils.fromWei(await fundContract.methods.goalAmount().call(), 'ether');
    let conCTK = await ctkContract.methods.getBalance(fundAddr).call();
    let usrETH, usrCTK;
    if (usrAddr === '') {
      usrETH = 0;
      usrCTK = 0;
    } else {
      usrETH = web3.utils.fromWei(await web3.eth.getBalance(usrAddr), 'ether');
      usrCTK = await ctkContract.methods.getBalance(usrAddr).call();
    }

    res.render('investor', {
      title: 'Investor',
      fundETH: fundETH,
      goalETH: goalETH,
      conCTK: conCTK,
      usrAddr: usrAddr,
      usrETH: usrETH,
      usrCTK: usrCTK,
    });
  };

  initInvestor();
});

router.get('/investor/withdraw', function(req, res, next) {
  let web3 = initWeb3();
  var fundContract = new web3.eth.Contract(fundabi, fundAddr);
  let usrAddr = req.query.addr;
  let pass = req.query.pass;
  let withdraw = async () => {
    await web3.eth.personal.unlockAccount(usrAddr, pass);
    await fundContract.methods.withdraw().send({from: usrAddr});

    res.redirect(`/investor?userAddress=${usrAddr}`);
  };
  withdraw();
});

router.get('/investor/join', function(req, res, next) {
  let web3 = initWeb3();
  web3.eth.getAccounts()
      .then(addresses => {
        res.render('join', {
          title: 'Join',
          addresses: addresses,
        })
      });
});

router.post('/investor/funding', urlencodedParser, function(req, res, next) {
  let web3 = initWeb3();
  let investorAddr = req.body.address;
  let passphase = req.body.passphase;
  let amount = req.body.amount;

  web3.eth.personal.unlockAccount(investorAddr, passphase, 600)
      .then(() => {
        var fundContract = new web3.eth.Contract(fundabi, fundAddr);
        web3.eth.sendTransaction({
          from: investorAddr,
          to: fundAddr,
          value: web3.utils.toWei(amount, 'ether')
        }).then(function (result) {
          res.redirect(`/investor?userAddress=${investorAddr}`)
        });
      });

});

module.exports = router;
