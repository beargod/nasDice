$(document).ready(function () {
    $('.slider-input').jRange({
        from: 1,
        to: 100,
        step: 1,
        scale: [1, 25, 50, 75, 100],
        format: '%s',
        width: 200,
        showLabels: true,
        isRange: true,
        theme: "theme-blue",
    });
});
var NebPay = require("nebpay"); //https://github.com/nebulasio/nebPay
var vm = new Vue({
    el: ".vue-app",
    data: {
        address: "",
        lowest: 0,
        commission: 0,
        jackpot: 0,
        all_history: [],
        user_history: [],
        history_size: 0,
        bet_up: 1,
        bet_down: 51,
        bet_size: 0.0001,
        bet_profit: 0.0,
        web_wallet: 1,
        wallet_balance: 0,
        chance: 50,
        short_hash: "",
        tx_hash: "aaaaaa",
        my_profit: 0,
        my_balance: 0,
        last_roll: 0,
        last_award: 0,
        take_balance: 0,
        is_user:1
    },
    methods: {
        min: function () {
            vm.$data.bet_size = vm.$data.lowest;
        },
        random: function () {
            if (vm.$data.wallet_balance < vm.$data.lowest) {
                vm.$data.bet_size = 0;
            } else {
                vm.$data.bet_size = RandomNumBoth(vm.$data.lowest, vm.$data.wallet_balance);
            }
        },
        max: function () {
            vm.$data.bet_size = vm.$data.wallet_balance;
        },
        roll: function () {
            roll();
        },
        copy_hash: function () {
            var obj = document.getElementById("hide_txhash");
            obj.select();
            document.execCommand("Copy");
            alert("复制链接成功！");
        },
        take_out: function () {
            takeOut();
        },
        all: function(){
            vm.$data.is_user=0;
            getUserHistory();
        },
        my: function () {
            vm.$data.is_user=1;
            getUserHistory();
        }
    },
    watch: {
        bet_size: function (newVal, oldVal) {

            if(newVal==0.000||newVal==0.00||newVal==0.0){
                this.bet_size = newVal;
                return;
            }
            var newVal = Math.round(newVal * 10000) / 10000;
            this.bet_size = newVal;

            if (newVal < vm.$data.wallet_balance && newVal > vm.$data.lowest) {
                resizeProfit();
                return;
            }

            if (vm.$data.wallet_balance < vm.$data.lowest) {
                this.bet_size = 0;
                resizeProfit();
                return;
            }

            if (vm.$data.wallet_balance < newVal) {
                this.bet_size = vm.$data.wallet_balance;
                resizeProfit();
                return;
            }
            if (vm.$data.lowest > newVal) {
                this.bet_size = vm.$data.lowest;
                resizeProfit();
            }
            resizeProfit();
        },

        take_balance: function (newVal, oldVal) {
            if(newVal==0.000||newVal==0.00||newVal==0.0){
                this.take_balance = newVal;
                return;
            }
            var newVal = Math.round(newVal * 10000) / 10000;
            if (newVal < 0) {
                newVal = 0;
            }
            if (newVal > this.my_balance) {
                newVal = this.my_balance;
            }
            this.take_balance = newVal;
        },
        bet_down: function (newVal, oldVal) {
            var newVal = Math.round(newVal);
            if (newVal > 100) {
                newVal = 100;
            }
            if (newVal - vm.$data.bet_up > 98 - vm.$data.commission) {
                newVal = 98 - vm.$data.commission + vm.$data.bet_up;
            }
            if (newVal < vm.$data.bet_up) {
                newVal = vm.$data.bet_up;
            }

            this.bet_down = newVal;
            vm.$data.chance = vm.$data.bet_down - vm.$data.bet_up+1;
            $('.slider-input').jRange('setValue', jrVal());
            resizeProfit();
        },
        bet_up: function (newVal, oldVal) {
            var newVal = Math.round(newVal);
            if (newVal < 1) {
                newVal = 1;
            }
            if (newVal > vm.$data.bet_down) {
                newVal = vm.$data.bet_down;
            }
            if (vm.$data.bet_down - newVal > 98 - vm.$data.commission) {
                newVal = vm.$data.bet_down+vm.$data.commission-98;
            }

            this.bet_up = newVal;
            vm.$data.chance = vm.$data.bet_down - vm.$data.bet_up+1;
            $('.slider-input').jRange('setValue', jrVal());
            resizeProfit();
        }
    }
});

$("#hide_txhash").hide();

var nebPay = new NebPay();
var dappAddress = "n1fPRVXkw7KczBVSCk5x3yr7x68GFRJqSpy";

//检查扩展是否已安装
//如果安装了扩展，var“webExtensionWallet”将被注入到web页面中1
if (typeof(webExtensionWallet) === "undefined") {
    //alert ("扩展钱包未安装，请先安装.")
    vm.$data.web_wallet = 0;
}
//获取钱包地址
var nebulas = require("nebulas"), Account = nebulas.Account, neb = new nebulas.Neb();
neb.setRequest(new nebulas.HttpRequest("https://mainnet.nebulas.io"));
getWalletInfo((address) => {
    vm.$data.address = address;
    //获取钱包余额
    getBalance();
});
//获取最小值
getLowest();
//获取奖池
getJackpot();

getUser();

getUserHistory();

var intervalQuery;

function getUserHistory() {
    var value = vm.bet_size;
    var callArgs = "";
    nebPay.simulateCall(dappAddress, value, "userHistory", callArgs, {
        listener: cbUserHistory
    });

}

function cbUserHistory(rs) {
    cbnetwork(rs);
    var hArray = JSON.parse(rs.result);
    if (!hArray) {
        return;
    }
    var uhArray = [];
    for (var i = 0; i < hArray.length; i++) {
        var uh = new Object();
        uh.id=hArray[i].id;
        uh.target=hArray[i].begin+"-"+hArray[i].under;
        uh.rolled=hArray[i].result;
        var award = bigNumberToNumber(hArray[i].award);
        uh.result=award>0?"win":"lose";
        uh.nas = award>0?"+"+award:"-"+bigNumberToNumber(hArray[i].nas);
        uhArray.push(uh);
    }
    vm.user_history=uhArray;
}

function takeOut() {
    var value = vm.bet_size;
    var callArgs = "[" + numberToBigNumber(vm.take_balance) + "]"
    nebPay.call(dappAddress, value, "takeout", callArgs, {
        listener: cbTakeout
    });
}

function cbTakeout(rs) {
    cbnetwork(rs);
    if (rs.hasOwnProperty('txhash') && rs.txhash) {
        alert("数据以及打包提交到链上，等待确认后将会自动刷新数据");
        intervalQuery = setInterval(function () {
            neb.api.getTransactionReceipt({hash: vm.tx_hash}).then(function (resp) {
                console.log("tx result: " + JSON.stringify(resp))
                if (resp.status == 1) {
                    clearInterval(intervalQuery);
                    intervalQuery=null;
                    alert("取出余额成功");
                    getJackpot();
                    getUser();
                }
            }).catch(function (err) {
                console.log(err);
            });
        }, 5000);
    }

}

function roll() {
    if (intervalQuery) {
        alert("请等待上个交易完成");
        return;
    }
    var value = vm.bet_size;
    var callArgs = "[" + vm.bet_up + "," + vm.bet_down + "]"
    nebPay.call(dappAddress, value, "play", callArgs, {
        listener: cbRoll
    });
}

function cbRoll(rs) {
    cbnetwork(rs);
    if (rs.hasOwnProperty('txhash') && rs.txhash) {
        vm.tx_hash = rs.txhash;
        var length = vm.tx_hash.length;
        vm.short_hash = vm.tx_hash.substr(0, 5) + "..." + vm.tx_hash.substr(length - 6, length - 1);
        alert("数据以及打包提交到链上，等待确认后将会自动刷新数据");
        intervalQuery = setInterval(function () {
            neb.api.getTransactionReceipt({hash: vm.tx_hash}).then(function (resp) {
                console.log("tx result: " + JSON.stringify(resp))
                if (resp.status == 1) {
                    clearInterval(intervalQuery);
                    successCb(resp);
                }
            }).catch(function (err) {
                console.log(err);
            });
        }, 5000);
    }

}


function successCb(rs) {
    var newRoll = JSON.parse(rs.result);
    if (!newRoll) {
        return;
    }
    vm.last_roll = newRoll.result;
    if (new BigNumber(newRoll.award).gt(0)) {
        alert("恭喜你，赢得了" + bigNumberToNumber(newRoll.award) + "nas");
    }
    vm.last_award = bigNumberToNumber(newRoll.award);
    getJackpot();
    getUser();
}

function getUser() {
    var value = 0;
    var callArgs = ""
    nebPay.simulateCall(dappAddress, value, "getUser", callArgs, {
        listener: cbUser
    });
}

function cbUser(rs) {
    cbnetwork(rs);
    var result = JSON.parse(rs.result);
    if (!result) {
        return;
    }

    vm.my_balance = bigNumberToNumber(toInt(result.balance));
    vm.my_profit = bigNumberToNumber(toInt(result.award));
}

function getJackpot() {
    var value = 0;
    var callArgs = ""
    nebPay.simulateCall(dappAddress, value, "getJackpot", callArgs, {
        listener: cbJackpot
    });
}

function cbJackpot(rs) {
    cbnetwork(rs);
    if (!rs.result) {
        return;
    }
    vm.jackpot = bigNumberToNumber(toInt(rs.result));
}

function getCommission() {
    var value = 0;
    var callArgs = ""
    nebPay.simulateCall(dappAddress, value, "getCommission", callArgs, {
        listener: cbCommission
    });
}

function resizeProfit() {
    vm.$data.bet_profit = (vm.$data.bet_size) * (1 / vm.$data.chance * 100 - 1 - vm.$data.commission);
    vm.$data.bet_profit = Math.round(vm.$data.bet_profit * 10000) / 10000;
}

function jrVal() {
    return vm.$data.bet_up + "," + vm.$data.bet_down;
}

function cbCommission(rs) {
    cbnetwork(rs);
    vm.$data.commission = Math.round(rs.result * 100);
    if (vm.$data.bet_down - vm.$data.bet_up > 100 - vm.$data.commission) {
        vm.$data.bet_down = 100 - vm.$data.commission + vm.$data.bet_up;
    }
}


function getLowest() {
    var value = 0;
    var callArgs = ""
    nebPay.simulateCall(dappAddress, value, "getLowest", callArgs, {
        listener: cbLowest
    });
}

function cbLowest(rs) {
    cbnetwork(rs);
    var result = rs.result;
    if (!result) {
        return;
    }
    vm.$data.lowest = bigNumberToNumber(toInt(result));
}

function cbnetwork(rs) {
    if (rs == "Network Error") {
        alert("星云链主网抽风啦，请稍后再试")
        return
    }
    if (rs == "Error: Transaction rejected by user") {
        alert("由于你拒绝了交易，数据没有成功上传到链上");
        return
    }
    if (!rs.execute_err && rs.execute_err != "") {
        alert(rs.execute_err);
    }
}

function bigNumberToNumber(num) {
    var number = new BigNumber(num).toNumber();
    number = Math.round(number / Math.pow(10, 14)) / 10000;
    ;
    return number;
}

function numberToBigNumber(num) {
    var number = new BigNumber(num);
    return number.mul(Math.pow(10, 18));
}

function toInt(str) {
    return str.replace(new RegExp("\"", "gm"), "");
}

function getWalletInfo(callback) {
    window.postMessage({
        "target": "contentscript",
        "data": {},
        "method": "getAccount",
    }, "*");

    window.addEventListener('message', function (e) {
        if (e.data && e.data.data) {
            if (e.data.data.account) { //这就是当前钱包中的地址
                var address = e.data.data.account;
                if (address && address.length != 0) {
                    if (callback) {
                        callback(address);
                    }
                }
            }
        }
    });
}

function getBalance() {
    neb.api.getAccountState(vm.$data.address).then(function (state) {
        state = state.result || state;
        vm.$data.wallet_balance = bigNumberToNumber(state.balance);
    }).catch(function (err) {
        console.log("err:", err);
    });
}

//获得随机数
function RandomNumBoth(Min, Max) {
    var Range = Max - Min;
    var Rand = Math.random();
    var num = Min + Rand * Range; //四舍五入
    return Math.round(num*10000)/10000;
};

$(document).ready(function () {
    // 获得区间上下限,split("")是把字符串分割成字符串数组
    $('.slider-input').change(function () {
        var change = $('.slider-input').val();

        var nn = change.split(',');
        vm.$data.bet_up = parseFloat(nn[0]);
        vm.$data.bet_down = parseFloat(nn[1]);
        vm.$data.chance = vm.$data.bet_down - vm.$data.bet_up+1;
    });
});

