/* jshint camelcase:false */
var gulp = require('gulp');
var plug = require('gulp-load-plugins')();
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var ngmin = require('gulp-angular-templatecache');
var htmlify = require('gulp-angular-htmlify');
var templates = require('gulp-angular-templatecache');
var minifyHTML = require('gulp-minify-html');
var del = require('del');
var uglifycss = require('gulp-uglifycss');
var base64 = require('gulp-base64-inline');
var replace = require('gulp-replace');



var log = plug.util.log;
var env = plug.util.env;

// Our server for dev
var express = require('express');
var app = express();
var browserSync = require('browser-sync');
var server_port = process.env.PORT || 8001;

// Load docs tasks
require('require-dir')('./docs');

// Generate a css file from the scss files
var sass = require('gulp-sass');

/**
 * Generate documentation‡
 */
gulp.task('doc', ['docs:clean'], function() {
    gulp.start('docs:build');
});

/**
 * Generate a css file from the scss files
 */
gulp.task('sass', function() {
    gulp.src('./src/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('./src'));
});

/****************************************************************************************************************
 * Run specs once and exit
 * To start servers and run midway specs as well:
 *    gulp test --startServers
 * @return {Stream}
 */
gulp.task('test', function(done) {
    startTests(true /*singleRun*/ , done);
});

/**
 * Start the tests using karma.
 * @param  {boolean} singleRun - True means run once and end (CI), or keep running (dev)
 * @param  {Function} done - Callback to fire when karma is done
 * @return {undefined}
 */
function startTests(singleRun, done) {
    var child;
    var excludeFiles = [];
    var fork = require('child_process').fork;
    var Server = require('karma').Server;

    var server = new Server({
        configFile: __dirname + '/karma.conf.js',
        exclude: excludeFiles,
        singleRun: !!singleRun
    }, karmaCompleted).start();

    function karmaCompleted() {
        if (child) {
            child.kill();
        }
        done();
    }
}



/****************************************************************************************************************
 * BUILD THE COMPONENT
 */

gulp.task('build', ['compile'], function() {
    del(['dist/tmp/**', ]);
    return gulp.src(['src/*.css'])
        .pipe(replace('background\-image\: url\(\"', 'background\: inline\(\"'))
        .pipe(base64(''))
        .pipe(concat('angular-dashboard-fluance.css'))
        .pipe(gulp.dest('dist'))
        .pipe(uglifycss({
            'max-line-len': 80
        }))
        .pipe(rename({
            extname: '.min.css'
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('compile', ['templatecache'], function() {
    return gulp.src(['src/*.js', 'dist/tmp/templates.js'])
        .pipe(concat('angular-dashboard-fluance.js'))
        .pipe(gulp.dest('dist'))
        .pipe(uglify())
        .pipe(rename({
            extname: '.min.js'
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('templatecache', function() {
    return gulp.src(['src/*.html'])
        .pipe(htmlify())
        .pipe(minifyHTML({
            quotes: true
        }))
        .pipe(templates('templates.js'))
        .pipe(gulp.dest('dist/tmp'));
});


/****************************************************************************************************************
 * PUBLISH THE DISTRIBUTION
 */

var git = require('gulp-git');
var runSequence = require('run-sequence');

gulp.task('publish', function(callback) {
    runSequence('build-clean', 'clonesub', callback);
});

/* Step 0 : Clean directory */
gulp.task('build-clean', function(callback) {
    del(['dist/*.js', 'dist/*.css'], callback);
});

/* Step 1 : Clone the bower repo into the dist directory */
gulp.task('clonesub', function(callback) {
    git.clone('https://github.com/fluanceit/bower-angular-dashboard', {
        args: 'dist'
    }, function(err) {
        if (err) throw err;
    });
});

/* Step 2 : Build the dashboard (copying files into the fresh clone) */
/* Step 3 : Commit the changes */
/* Step 4 : Generate newest tag from main repo */
/* Step 5 : Tag the git clone */
/* Step 6 : Push the new version to the github repo */
/* Step 7 : Wipe the dist directory */



/****************************************************************************************************************
 * Serve the dev environment
 */
gulp.task('serve', ['sass'], function() {
    serve({
        mode: 'dev',
        file: 'simple'
    });
});

/**
 * Start the node server using nodemon.
 * Optionally start the node debugging.
 * @param  {Object} args - debugging arguments
 * @return {Stream}
 */
function serve(args) {

    var server = './scripts/';

    var options = {
        script: server + 'app.js',
        delayTime: 1,
        env: {
            'NODE_ENV': args.mode,
            'PORT': server_port
        },
        watch: [server]
    };

    return plug.nodemon(options)
        .on('start', function() {
            startBrowserSync();
            gulp.watch('./src/**/*.scss', ['sass']);
        })
        //.on('change', tasks)
        .on('restart', function() {
            log('restarted!');
            setTimeout(function() {
                browserSync.reload({
                    stream: false
                });
            }, 1000);
        });
}

/**
 * Start BrowserSync
 */
function startBrowserSync() {
    if (!env.sync || browserSync.active) {
        return;
    }

    var filestowatch = [
        './demos/**/*.html',
        './src/**/*.js',
        './src/**/*.css',
        './src/**/*.html',
        './src/**/*.json',
        './src/content/images/**/*.*'
    ];

    log('Starting BrowserSync on port ' + server_port);
    browserSync({
        proxy: 'localhost:' + server_port,
        port: 3000,
        files: filestowatch,
        ghostMode: { // these are the defaults t,f,t,t
            clicks: true,
            location: false,
            forms: true,
            scroll: true
        },
        logLevel: 'debug',
        logPrefix: 'gulp-patterns',
        notify: false,
        reloadDelay: 1000
    });
}
