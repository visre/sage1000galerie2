var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// var routes = require('./routes/index');
// var users = require('./routes/users');

var app = express();

var azure = require('azure');
var formidable = require('formidable');
var fs = require('fs');
var jf = require('jsonfile');
var url = require('url');

var storage_account = 'gallerie';
var gallerieKey = 'SiQVY98VhO+NI1m6jfBMgB1M/00geM/puCgpMpRvsBSUz0H/xcgF77Wx9SiD7buJFvXZ9NTvyRNvf200CNT6Kg==';
var package_container = 'packages';
var packages_folder = __dirname + '/databases/packages/';
var index_container = 'descriptifs';
var images_container = 'images';

var blobService = azure.createBlobService(storage_account,gallerieKey);

app.all('*', function(req, res, next){
    res.set("Connection", "close");
    next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/gallery/getPackageJSON', function(req, res){
    jf.readFile(__dirname + '/databases/packages.json', function (err, obj){
        res.send(obj);  
    });
});

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/', routes);

app.get('/gallery', function (req, res){
    res.render('index');
});

app.get('/gallery/product/download', function(req, res){
    var item = url.parse(req.url).query;
    var filePath = packages_folder + item + '.zip';
    blobService.getBlobToFile(package_container, item + '.zip', filePath, function(error, result, response){
        if(!error){
            var returnHeaders = {};
            returnHeaders['Content-Disposition'] = 'attachment; filename="'+ item +'.zip"';
            returnHeaders['Content-Type'] = 'application/zip';
            returnHeaders['Connection'] = "close";
            res.writeHead(200, returnHeaders); 
            var stream = fs.createReadStream(filePath);
            stream.on('open', function () {     
                stream.pipe(res);
            });
            stream.on('end', function () {
                res.end();
            });         
        }
        else{
            res.render('unfind');
            console.log(error);
        }
    });         
});

app.get('/gallery/product/install', function(req, res){
    var adresse = { 
        "name" : req.query.name,
        "blobUrl" : '/gallery/product/download?' + req.query.name,
        "category" : req.query.category
    };
    res.end(JSON.stringify(adresse));
});

// // catch 404 and forward to error handler
// app.use(function(req, res, next) {
//     var err = new Error('Not Found');
//     err.status = 404;
//     next(err);
// });

// // error handlers

// // development error handler
// // will print stacktrace
// if (app.get('env') === 'development') {
//     app.use(function(err, req, res, next) {
//         res.status(err.status || 500);
//         res.render('error', {
//             message: err.message,
//             error: err
//         });
//     });
// }

// production error handler
// no stacktraces leaked to user
// app.use(function(err, req, res, next) {
//     res.status(err.status || 500);
//     res.render('error', {
//         message: err.message,
//         error: {}
//     });
// });

function Init(){
    // Get index.json
    blobService.getBlobToFile(index_container, 'packages.json', __dirname + '/databases/packages.json', function(error, result, response){
    });
};

Init();

app.listen(3000, function () {
console.log("express has started on port 3000");
});

module.exports = app;
