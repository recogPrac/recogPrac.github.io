// set up basic variables for app

let record = document.querySelector('.record');
let stop = document.querySelector('.stop');
let soundClips = document.querySelector('.sound-clips');
let canvas = document.querySelector('.visualizer');
let mainSection = document.querySelector('.main-controls');
let jsonResult = document.querySelector('.jsonResult');
let form = document.forms.namedItem("fileInfo");
let oOutput = document.querySelector(".resultForm");
let sessionId = "";
let sendBlobCall = 0;
// disable stop button while not recording

stop.disabled = true;

// visualiser setup - create web audio api context and canvas

let audioCtx = new (window.AudioContext || webkitAudioContext)();
let canvasCtx = canvas.getContext("2d");

function sendBlob(blob){
    console.log("sending the blob");

    let oData = new FormData();
    //oData.append("epdFlag", 0);
    //oData.append("epdFlag",1);
    //oData.append("epdFlag",2);
    console.log(blob);
    oData.append('audio', blob);
    console.log(oData.get('audio'));

    let xhr = new XMLHttpRequest();
    console.log(sessionId);
    console.log(++sendBlobCall);
    let path = "http://127.0.0.1:10411/soundData/" + sessionId + "/" + sendBlobCall;
    console.log(path);
    xhr.open('POST', path);
    xhr.responseType = "json";
    xhr.onload = function(e){
        if(this.status !== 200){
            console.log(this.status);
        } else if (this.status === 200 && this.response !== null){
            let result = this.response;
            jsonResult.innerHTML = JSON.stringify(result);
            console.log(result);
        }
    }
    xhr.send(oData);
}

function sendBlobWithFin(blob){
    console.log("sending blob with Fin");

    let oData = new FormData();

    console.log(blob);
    oData.append('', blob);

    let xhr = new XMLHttpRequest();
    let path = "http://127.0.0.1:10411/soundData/" + sessionId +"/FIN";
    xhr.open('POST', path);
    xhr.responseType = "json";
    xhr.onload = function(e){
        if(this.status !== 200){
            console.log(this.status);
        } else if (this.status === 200 && this.response !== null){
            let FinalResult = this.response;
            jsonResult.innerHTML = JSON.stringify(FinalResult);
            console.log(FinalResult);
        }
    }
    xhr.send(oData);
}

function init(){
    console.log("init");
    let xhr = new XMLHttpRequest();
    xhr.open('POST','http://127.0.0.1:10411/init', true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    //xhr.setRequestHeader("x-clova-request-id", "1");
    xhr.responseType="json";
    xhr.onload = function(e){
        console.log(this.status);
        if(this.status === 200){
            console.log("Json expected");
            let data = xhr.response;
            sessionId = data['sessionId'];
            console.log(sessionId);
        } else{
            console.log(this.status);
        }
    }
    xhr.send(JSON.stringify({
        "Version": 261,
        "CompressionType" : 1,
        "ClientExtraInfo":{
            "Platform" : "Android",
            "Device": "SHW-M110S",
            "OS": "2.2.1",
            "FeatVer" : "nscli_ver_1.2.0",
            "Auth": "NAVER.gyukatsu",
            "Lang": "Kor"
        }
    }));
}

//main block for doing the audio recording
if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supported.');
    init();

    let constraints = { audio: true , video: false };
    let chunks = [];

    let onSuccess = function(stream) {
        let options = {audioBitsPerSecond: 25600};//16000 * 16 * 1
        let mediaRecorder = new MediaRecorder(stream, options);

        visualize(stream);

        record.onclick = function() {
            mediaRecorder.start();
            console.log(mediaRecorder.state);
            console.log("recorder started");
            record.style.background = "red";
            stop.disabled = false;
            record.disabled = true;
            //const start = new Date();
            let i = 1;
            let j = 1;
            let requestData = setInterval(function() {
                mediaRecorder.requestData();
                if(chunks.length >= 6){
                    console.log(++j);
                    let blob = new Blob(chunks);
                    if(blob.size >= 6400){
                        sendBlob(blob.slice(0,6399));
                        chunks = [];
                        if(++i === 10)
                            return clearInterval(requestData);
                    }
                }
            }, 150);
        }//TODO: 78byte, 640 byte
        //TODO: 6400byte

        stop.onclick = function() {
            mediaRecorder.stop();
            console.log(mediaRecorder.state);
            console.log("recorder stopped");
            record.style.background = "";
            record.style.color = "";

            stop.disabled = true;
            record.disabled = false;
        }

        mediaRecorder.onstop = function(e) {
            console.log("data available after MediaRecorder.stop() called.");

            let clipName = prompt('Enter a name for your sound clip?','My unnamed clip');
            console.log(clipName);
            let clipContainer = document.createElement('article');
            let clipLabel = document.createElement('p');
            let audio = document.createElement('audio');
            let deleteButton = document.createElement('button');

            clipContainer.classList.add('clip');
            audio.setAttribute('controls', '');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'delete';

            if(clipName === null) {
                clipLabel.textContent = 'My unnamed clip';
            } else {
                clipLabel.textContent = clipName;
            }

            clipContainer.appendChild(audio);
            clipContainer.appendChild(clipLabel);
            clipContainer.appendChild(deleteButton);
            soundClips.appendChild(clipContainer);

            audio.controls = true;

            let blob = new Blob(chunks);
            chunks = [];
            console.log(blob.type);
            console.log(blob.size);
            sendBlobWithFin(blob);

            let audioURL = window.URL.createObjectURL(blob);
            audio.src = audioURL;
            console.log("recorder stopped");

            deleteButton.onclick = function(e) {
                evtTgt = e.target;
                evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
            }

            clipLabel.onclick = function() {
                let existingName = clipLabel.textContent;
                let newClipName = prompt('Enter a new name for your sound clip?');
                if(newClipName === null) {
                    clipLabel.textContent = existingName;
                } else {
                    clipLabel.textContent = newClipName;
                }
            }
        }

        mediaRecorder.ondataavailable = function(e) {
            chunks.push(e.data);
        }
    }

    let onError = function(err) {
        console.log('The following error occured: ' + err);
    }

    navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);

} else {
    console.log('getUserMedia not supported on your browser!');
}

function visualize(stream) {
    let source = audioCtx.createMediaStreamSource(stream);
    let analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    let bufferLength = analyser.frequencyBinCount;
    let dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    //analyser.connect(audioCtx.destination);

    draw()

    function draw() {
        WIDTH = canvas.width;
        HEIGHT = canvas.height;

        requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

        canvasCtx.beginPath();

        let sliceWidth = WIDTH * 1.0 / bufferLength;
        let x = 0;


        for(let i = 0; i < bufferLength; i++) {

            let v = dataArray[i] / 128.0;
            let y = v * HEIGHT/2;

            if(i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
    }
}

window.onresize = function() {
    canvas.width = mainSection.offsetWidth;
}

window.onresize();