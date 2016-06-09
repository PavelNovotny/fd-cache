/**
 *
 * Created by pavelnovotny on 02.10.15.
 */

var fdCache = require("../lib/fd-cache.js");
var fs = require("fs");
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "testFdCache"});
log.level("info");
var testFile = "../hashSeek/hashSeekFiles/hash/jms_s1_alsb_aspect.audit.20150425.bgz.hash_v1.bgz";

describe('fdCacheTest', function() {
    describe('#fdCache', function() {
        it('should open only once, the other openings would be from cache', function(done) {
            fdCache.init({ttl:1500, checkperiod:100});
            for (var i = 0; i < 100; i++) {
                fdCache.getFd(testFile, function(err,fd) {
                    log.info("file opened "+ fd);
                });
            }
            setTimeout(function () {for (var i = 0; i < 100; i++) {
                fdCache.getFd(testFile, function(err,fd) {
                    log.info("file delayed opened "+ fd);
                });
            }}, 1500);
        });
    });

});

