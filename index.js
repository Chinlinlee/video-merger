const path = require("node:path");
const { program } = require("commander");
const glob = require("glob");
const fs = require("fs");
const uid = require("uid/secure");
// https://creatomate.com/blog/how-to-use-ffmpeg-in-nodejs
const ffmpegInstance = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstance);
function convertToAbsolutePath(folder) {
    return path.resolve(folder);
}

// Use glob to fetch all video files in the input folder
function getAllVideos(folder) {
    return glob.globSync(`${folder}/*.{mp4,mov,avi,mkv}`, {
        absolute: true
    });
}

function mergeVideos(listTxtFile, dest) {
    ffmpeg(listTxtFile)
        .inputOption("-f concat")
        .inputOption("-safe 0")
        .outputOption("-c copy")
        .save(dest)
        .on("start", function (cmdline) {
            console.log('start: Command line: ' + cmdline);
        })
        .on("end", function (stdout, stderr) {
            console.log(`merged video file can be found at ${dest}`);
        });
}

function renameToNumberByTime(fileCollection) {
    let newFileCollection = [];
    for (let i = 0 ; i < fileCollection.length ; i++) {
        let file = fileCollection[i];
        let ext = path.extname(file);
        let dest  = path.join(path.dirname(file), `/${i + 1}-${uid.uid(6)}${ext}`);
        console.log(`rename ${file} to ${dest}`);
        fs.renameSync(file, dest);
        newFileCollection.push(dest);
    }
    return newFileCollection;
}

program.requiredOption("-i, --input <folder>", "The folder contain the videos");

program.parse();

const options = program.opts();
let folder = options.input;

if (!path.isAbsolute(folder)) {
    folder = convertToAbsolutePath(folder);
}

(async () => {
    let videosInFolder = getAllVideos(folder);

    videosInFolder.sort((a, b) => {
        const aNumber = parseInt(path.basename(a).split(".")[0]);
        const bNumber = parseInt(path.basename(b).split(".")[0]);
        if (aNumber !== bNumber &&
            (!isNaN(aNumber) || !isNaN(bNumber))
        ) {
            return aNumber - bNumber;
        }

        const aModified = fs.statSync(a).mtime.getTime();
        const bModified = fs.statSync(b).mtime.getTime();
        return aModified - bModified;
    });

    videosInFolder = renameToNumberByTime(videosInFolder);
    let ext = path.extname(videosInFolder[0]);
    let dest = path.join(
        path.dirname(videosInFolder[0]),
        `output${ext}`
    );

    for (let i = 0 ; i < videosInFolder.length ; i++) {
        console.log(`write video: ${videosInFolder[i]}`)
    }
    let data = videosInFolder.map(v => `file 'file:${v}'`).join("\n");
    let videosListTxtFile = `./${uid.uid(16)}.txt`;
    fs.writeFileSync(
        path.join(__dirname, videosListTxtFile),
        //https://superuser.com/questions/718027/ffmpeg-concat-doesnt-work-with-absolute-path
        data
    );

    process.on("exit", () => {
        fs.unlinkSync(path.join(__dirname, videosListTxtFile));
    });

    process.on("SIGINT", () => {
        fs.unlinkSync(path.join(__dirname, videosListTxtFile));
    });

    mergeVideos(videosListTxtFile, dest);
})();

