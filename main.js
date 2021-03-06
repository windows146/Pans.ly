var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var router = express.Router();

var pg = require('pg');

app.use(express.static('public')); // no jade, read the docs

router.use(function (req, res, next) {
    // logging
    console.log('something is happening');
    next(); // go to the next route and don't stop here
});

/* We'll create, initially, two API functions:
 * 
 *      One for creating a shortened URL hash. This is for initial testing and development purposes.
 *      
 *      And one for creating a PostgreSQL database entry of a shortened URL.
 *      
 * We'll need to create a third API function, a GET request, for actually redirecting to a
 * shortened URL.
 */


router.route('/shorten/*') // had to use a wildcard, API user will have to use ?url=url.com
        .post(function (req, res) {
            // now to shorten the URL. just create a new string is all, lol
            alphabet = 'abcdefghijklmnopqrstuvwxyz';
            newUrl = '';
            for (i = 0; i < 7; i++) {
                newUrl += alphabet[Math.floor(Math.random() * alphabet.length)];
            }

            hash = {}; // JSON object for the client

            hash.longUrl = req.query.url;
            hash.shortUrl = newUrl;

            // for now, just return it in the response for the client to decide
            res.send(hash);
        });

router.route('/createEntry')
        .post(function (req, res) {
            /*
             * You have to create a database named pansly, because I don't want to
             * write code to create a database here.
             * 
             * Pans.ly database looks like so:
             * CREATE TABLE urls (
             *      long_name       varchar(80),
             *      short_name      varchar(80),
             *      creation_time   date            -- optional, for if we want to delete all entries older than 24 hours
             * );
             */

            client = new pg.Client(process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/pansly');

            client.connect(function (err) {
                if (err)
                    throw err;

                client.query('INSERT INTO urls (long_name, short_name) VALUES ($1, $2)',
                        [req.body.data.longUrl, req.body.data.shortUrl],
                        function (err, result) {
                            if (err)
                                throw err;

                            client.end(function (err) {
                                if (err)
                                    throw err;
                            });
                        });
            });

            res.send(req.body); // just to not leave the client hanging
        });

router.route('/getURL/:shortUrl') // need to do something about route prefixes--or not
        .get(function (req, res) {
            client = new pg.Client(process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/pansly');

            client.connect(function (err) {
                if (err)
                    throw err;

                client.query('SELECT DISTINCT long_name FROM urls WHERE short_name=$1',
                        [req.params.shortUrl],
                        function (err, result) {
                            if (err)
                                throw err;

                            // thank goodness!
                            if (result.rows[0].long_name.match(/^http:\/\//) || result.rows[0].long_name.match(/^https:\/\//)) {
                                res.redirect(result.rows[0].long_name);
                            } else {
                                res.redirect('http://' + result.rows[0].long_name);
                            }

                            client.end(function (err) {
                                if (err)
                                    throw err;
                            });
                        });
            });

        });

app.use('/api', router); // might as well prefix with '/api'

app.listen(process.env.PORT || 3000, function () {
    console.log('Pans.ly API server listening on port 3000');
});