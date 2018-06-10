"use strict";


var Roll = function (text) {

    if (text) {

        var obj = JSON.parse(text);
        this.id = obj.id;
        this.nas = obj.nas;
        this.under = obj.under;
        this.award = obj.award;
        this.result = obj.result;
        this.begin = obj.begin;
        this.from = obj.from;
    } else {
        this.id = 0;
        this.nas = new BigNumber(0);
        this.under = 0;
        this.award = new BigNumber(0);
        this.result = 0;
        this.begin = 0;
        this.from = "";
    }

};

Roll.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }

};

var User = function (text) {

    if (text) {
        var obj = JSON.parse(text);
        this.history = obj.history;
        this.hSize = obj.hSize;
        this.balance = obj.balance;
        this.use = obj.use;
        this.award = obj.award;
    } else {
        this.hSize = 0;
        this.history = [];
        this.balance =  new BigNumber(0);
        this.use =  new BigNumber(0);
        this.award =  new BigNumber(0);
    }

};

User.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }

};


var NasRoll = function () {

    LocalContractStorage.defineMapProperty(this, "roll", {

        parse: function (text) {

            return new Roll(text);

        },

        stringify: function (o) {

            return o.toString();

        }

    });

    LocalContractStorage.defineMapProperty(this, "user", {

        parse: function (text) {

            return new User(text);

        },

        stringify: function (o) {

            return o.toString();

        }

    });

    LocalContractStorage.defineProperty(this, "jackpot");

    LocalContractStorage.defineProperty(this, "owner");

    LocalContractStorage.defineProperty(this, "rollSize");

    LocalContractStorage.defineProperty(this, "commission");

    LocalContractStorage.defineProperty(this, "myCommission");



    LocalContractStorage.defineProperty(this, "lowest");

};


NasRoll.prototype = {

    init: function () {
        this.jackpot = new BigNumber(0);
        this.lowest = new BigNumber(10000000000000);
        this.rollSize = 0;
        this.awardSize = 0;
        this.commission = 0.0;
        this.myCommission = new BigNumber(0);
        this.owner = Blockchain.transaction.from;
    },

    // roll
    play: function (begin,under) {
        if(!under||!begin||under<1||under>100||under<begin||begin<1||begin-under>(99-(this.commission*100))){
            throw new Error("number error");
        }
        var value =Blockchain.transaction.value;
        if(value.lt(this.lowest)){
            throw new Error("value error");
        }
        var from = Blockchain.transaction.from;
        var random = this._getRandom(1,100);
        var award = (value.div((under-begin+1.0)/100.0)).round();
        var commissionAward = (award.mul(this.commission)).round();
        award = award.sub(commissionAward);
        var win = random<=under&&random>=begin;
        var roll = new Roll();

        roll.id = this.rollSize;
        roll.nas = value;
        roll.under = under;

        roll.result = random;
        roll.begin = begin;
        roll.from = from;
        var user = this.user.get(from);
        if(!user){
            user = new User();
        }
        user.history.unshift(roll.id);
        user.hSize++;

        var awardHistory = LocalContractStorage.get("awardHistory");
        if(!awardHistory){
            awardHistory = new Array();
        }
        awardHistory.unshift(roll.id);
        LocalContractStorage.set("awardHistory",awardHistory);

        user.use = new BigNumber(user.use).plus(value);
        if(win){
            this.myCommission = commissionAward.add(this.myCommission);
            roll.award = award;
            user.award = new BigNumber(user.award).plus(award);
            if(award.gt(this.jackpot)){
                user.balance = new BigNumber(user.balance).plus(award);
            }else {
                this._transfer(from,award);
                this.jackpot = new BigNumber(this.jackpot).sub(award);
            }
        }else {
            roll.award = 0;
        }
        this.jackpot = new BigNumber(this.jackpot).plus(value);
        this.user.set(from,user);
        this.roll.set(roll.id,roll);
        this.rollSize++;
        return roll;
    },

    _transfer: function(from,amount){
        var result = Blockchain.transfer(from, amount);
        if (!result) {
            throw new Error("transfer failed.");
        }
        Event.Trigger("BankVault", {
            Transfer: {
                from: Blockchain.transaction.to,
                to: from,
                value: amount.toString()
            }
        });
    },

    _getRandom: function (min, max) {
        var r = Math.random() * (max - min);
        var re = Math.round(r + min);
        re = Math.max(Math.min(re, max), min)
        return re;
    },

    // 取钱
    takeout: function (value) {
        var from = Blockchain.transaction.from;
        var user = this.user.get(from);
        if(value<=0){
            throw new Error("value error");
        }
        var amount = new BigNumber(value).round();
        if(amount.gt(user.balance)){
            throw new Error("用户余额不够");
        }
        if(amount.gt(this.jackpot)){
            throw new Error("奖池余额不够");
        }
        this._transfer(from,value);

        user.balance=new BigNumber(user.balance).sub(value);
        this.user.set(from,user);

        this.jackpot = new BigNumber(this.jackpot).sub(value);
    },

    // 用户roll历史
    userHistory: function (begin,end) {
        var from = Blockchain.transaction.from;
        var user = this.user.get(from);
        if(!user){
            throw new Error("该用户没有roll历史");
        }
        if(begin>end||begin<0||begin>user.hSize){
            throw new Error("size error");
        }
        end = end>user.hSize?user.hSize:end;
        var history = [];
        for (var i = begin; i < end; i++) {
            history.push(this.roll.get(user.history[i]));
        }
        return history;
    },

    // 奖励历史大小
    getSize: function(){
        var awardHistory = LocalContractStorage.get("awardHistory");
        return awardHistory?awardHistory.length:0;
    },

    // 奖励历史数据
    getHistory: function (begin,end) {
        if(begin>end||begin<0||begin>this.getSize()){
            throw new Error("size error");
        }
        end = end>this.getSize()?this.getSize():end;
        var history = [];
        var awardHistory = LocalContractStorage.get("awardHistory");
        for (var i = begin; i < end; i++) {
            history.push(this.roll.get(awardHistory[i]));
        }
        return history;
    },

    // 获取用户信息
    getUser: function () {
        var from = Blockchain.transaction.from;
        return this.user.get(from);
    },

    // 奖池
    getJackpot: function () {
        return this.jackpot;
    },

    // 获取佣金百分比
    getCommission: function () {
        return this.commission;
    },

    setCommission:function (commission) {
        this._onlyOwner();
        this.commission = commission;
    },

    getMyCommission: function(){
        this._onlyOwner();
        return this.myCommission;
    },

    getLowest: function(){
        return this.lowest;
    },

    setLowest: function(value){
        this._onlyOwner();
        return this.lowest = new BigNumber(value);
    },

    takeoutCommission: function(value){
        this._onlyOwner();
        var from = Blockchain.transaction.from;
        if(value<=0){
            throw new Error("value error");
        }
        var amount = new BigNumber(value).round();
        if(amount.gt(this.myCommission)){
            throw new Error("用户余额不够");
        }
        if(amount.gt(this.jackpot)){
            throw new Error("奖池余额不够");
        }
        this._transfer(from,value);
        this.jackpot=new BigNumber(this.jackpot).sub(value);
        this.myCommission=new BigNumber(this.myCommission).sub(value);
    },

    _onlyOwner: function () {
        var from = Blockchain.transaction.from;
        if(from!=this.owner){
            throw new Error("not owner");
        }
    }
};


module.exports = NasRoll;