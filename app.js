var express = require('express');
var path = require('path');
var app = express();
var azure = require('azure');
var bodyParser = require('body-parser');
var formidable = require('formidable');
var fs = require('fs');
var jf = require('jsonfile');
// var path = require('path');
var url = require('url');

var storage_account = 'gallerie';
var gallerieKey = 'SiQVY98VhO+NI1m6jfBMgB1M/00geM/puCgpMpRvsBSUz0H/xcgF77Wx9SiD7buJFvXZ9NTvyRNvf200CNT6Kg==';
var package_container = 'packages';
var index_container = 'descriptifs';
var images_container = 'images';

var blobService = azure.createBlobService(storage_account,gallerieKey);
var packages_folder = __dirname + '/databases/packages/';

app.all('*', function(req, res, next){
    res.set("Connection", "close");
    next();
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');;

app.use(express.static(__dirname + '/public'));
app.use("/databases", express.static(__dirname + '/databases'));
app.use("/controllers", express.static(__dirname + '/controllers'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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

app.get('/gallery/getPackageJSON', function(req, res){
    jf.readFile(__dirname + '/databases/packages.json', function (err, obj){
        res.send(obj);  
    });
});

app.post('/gallery/addProduct', function(req, res){
    //1 - Lease the blob
    //2 - Get the blob & read
    //3 - Write the product
    //4 - Upload the JSON
    //5 - Upload the package
    //6 - Release the blob
    blobService.getBlobToFile(index_container, 'packages.json', __dirname + '/databases/packages.json', function(error, result, response){
        var form = new formidable.IncomingForm();
        var captures = [];
        var readStream;
        var writeStream;
        var extImg = "";
        var applications = [];
        form.multiples = true;

        //Récupération du multiple select applications
        form.on('field', function(field, value) {
            if (field === "inputSelectApplication")
                applications.push(value);
        });

        //Récupération des captures et upload dans azure
        form.parse(req, function(err, fields, files){
            var name = fields.inputName.replace(/\s+/g, '').replace(/\'+/g,'').replace(/(é|è|ê)/g, 'e').replace(/(à|â)/g,'a').toLowerCase();
            if (files.inputCaptures.length > 0){
                for (var index in files.inputCaptures){

                    if (files.inputCaptures[index].type === 'image/jpeg'){
                        extImg = ".jpg";
                    }
                    else if(files.inputCaptures[index].type === 'image/png'){
                        extImg = ".png";
                    }
                    captures.push({"capture" : name + '-' + index + extImg});
                    readStream = fs.createReadStream(files.inputCaptures[index].path);
                    writeStream = fs.createWriteStream(__dirname + '/public/gallery/img/' + name + '-' + index + extImg);
                    readStream.pipe(writeStream);
                    blobService.createBlockBlobFromFile(images_container, name + '-' + index + extImg, files.inputCaptures[index].path, function(){});
                };
            }

            if (files.inputImage.path !== ""){
                readStream = fs.createReadStream(files.inputImage.path);
                if (files.inputImage.type === 'image/jpeg'){
                    extImg = ".jpg";
                }
                else if(files.inputImage.type === 'image/png'){
                    extImg = ".png";
                }
                writeStream = fs.createWriteStream(__dirname + '/public/gallery/img/' + name + extImg);
                readStream.pipe(writeStream);
            }

            readStream = fs.createReadStream(files.inputPackage.path);
            writeStream = fs.createWriteStream(__dirname + '/databases/packages/' + name + ".zip");
            readStream.pipe(writeStream);

            var product = {"type" : "product", "name" : fields.inputName, "link" : name, "description" : fields.inputDescription, "price" : 0, "file" : name + extImg, "package" : name + ".zip", "category" : fields.inputCategory, "application" : applications,"captures": fields.inputCaptures, "countView" : 0, "countOrder" : 0, "captures": captures};

            jf.readFile(__dirname + '/databases/packages.json', function (err, obj){
                for(var i = 0; i < obj.length; i++){
                    if(obj[i]['name'] === name){
                        res.redirect(res.render('failure'));
                    }
                }
                obj.push(product);
                jf.writeFile(__dirname + '/databases/packages.json', obj, function(err){
                    if(!err){
                        blobService.createBlockBlobFromFile(index_container, "packages.json", __dirname + '/databases/packages.json', function(){});
                    }
                    else{
                        console.log(err);
                    }
                }); 
                
                blobService.createBlockBlobFromFile(package_container, name + ".zip", files.inputPackage.path, function(){
                    blobService.createBlockBlobFromFile(images_container, name + extImg, files.inputImage.path, function(){ 
                        res.render('success');
                    });
                });                     
            });
        });
    });
});

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
