var fs = require('fs');
var bunyan = require('bunyan');

var log = bunyan.createLogger({name: "fd-cache"});
log.level("info");

var fdCache = {};
var waitingCallbacks = {};
var checkInterval; //check interval in millis
var ttl; //time to live in millis

exports.getFd = function(file, callback) {
    if (fdCache[file] === undefined) {
        fdCache[file] = {};
    }
    var fd = fdCache[file].fd;
    if (fd === undefined) {
        log.debug("undefined fd for "+ file);
        if (waitingCallbacks[file] === undefined) {
            log.debug("undefined waitingCallbacks for "+ file);
            waitingCallbacks[file] = [];
            fs.open(file,'r',function(err, fd) {
                if (err) {
                    for (var i =0; i< waitingCallbacks[file].length; i++) {
                        waitingCallbacks[file][i](err); //zajistíme aby každý doposud zaregistrovaný callback obdržel error
                    }
                    delete waitingCallbacks[file]; //vyčistíme callbacky
                    return callback(err);
                }
                fdCache[file] = {fd: fd, lastUse: Date.now()};
                //mezitim mohly prijit dalsi pozadavky, ktere se akumulovaly do waitingCallbacks
                log.info("fs file opened "+ file +"| fd "+ fd +"| waitingCallback count " + waitingCallbacks[file].length);
                for (var i =0; i< waitingCallbacks[file].length; i++) {
                    waitingCallbacks[file][i](null, fd);
                }
                delete waitingCallbacks[file]; //dočistíme vyřízené callbacky
                return callback(null, fd); //puvodni callback, ktery jsme si na zacatku nevlozili do waitingCallbacks
            });
        } else { //otevirani souboru již probíhá, ale fd ještě nemáme, musíme zpracovat callbacky až bude.
            log.debug("pushing callback for "+ file);
            waitingCallbacks[file].push(callback);
        }
    } else {
        log.info("returned cached fd value "+fd+" for "+ file);
        fdCache[file].lastUse = Date.now();
        return callback(null, fd);
    }
}

exports.init = function (options) {
    ttl = options.ttl; //time to live in millis
    checkInterval = setInterval(checkData, options.checkperiod); //in millis
};

exports.close = function() { //nevím jestli tohle explicitně vystavovat, mělo by stačit zavírání v rámci doběhu
    log.info("closing fd-cache");
    clearInterval(checkInterval);
    for (var key in fdCache) {
        closeFile(key);
    }
    fdCache = {};
}

function closeFile(file) {
    log.info("closing " + fdCache[file].fd + " | "+ file);
    fs.close(fdCache[file].fd, function(err) {
        if (err) {
            log.error(err);
        }
    });
}

function checkData() {
    log.info("checking data ");
    var filesToClose = [];
    for (var file in fdCache) {
        filesToClose.push(file);
    }
    var now = Date.now();
    for (var i=0; i< filesToClose.length; i++) {
        if (now - fdCache[filesToClose[i]].lastUse > ttl) {
            closeFile(filesToClose[i]);
            delete fdCache[filesToClose[i]];
        }
    }
};


