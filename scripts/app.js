// set up basic variables for app

let record = document.querySelector('.record');
let stop = document.querySelector('.stop');
let soundClips = document.querySelector('.sound-clips');
let canvas = document.querySelector('.visualizer');
let mainSection = document.querySelector('.main-controls');
let jsonResult = document.querySelector('.json-result');
let form = document.forms.namedItem("fileInfo");
let oOutput = document.querySelector(".resultForm");

// disable stop button while not recording

stop.disabled = true;

// visualiser setup - create web audio api context and canvas

let audioCtx = new (window.AudioContext || webkitAudioContext)();
let canvasCtx = canvas.getContext("2d");

function sendBlob(blob, sessionId, sequenceId){
    console.log("sending the blob");

    var oData = new FormData();
    oData.append("epdFlag", 0);
    //oData.append("epdFlag",1);
    //oData.append("epdFlag",2);
    oData.append("audio", blob);

    var xhr = new XMLHttpRequest();
    xhr.open('POST','http://127.0.0.1:10411/soundData/'+sessionId+'/'+sequenceId);
    xhr.responseType = "json";
    xhr.onload = function(e){
        if(this.status === 201){
            var json = xhr.response;
            jsonResult.textContent = json;
            console.log(json);
        } else{
            console.log(this.status);
        }
    }
    xhr.send(oData);
}

function init(){
    console.log("init");
    let xhr = new XMLHttpRequest();
    let sessionId = ""
    xhr.open('POST','http://127.0.0.1:10411/init', true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.responseType="json";
    xhr.onLoad = function(e){
        if(this.status === 201){
            let json = xhr.response;
            sessionId = json.sessionId;
            jsonResult.textContent = json;
            console.log(json);
        } else{
            console.log(this.status);
        }
    };
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
    return sessionId
}

//main block for doing the audio recording
if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supported.');
    let sessionId = init();

    let constraints = { audio: true };
    let chunks = [];

    let onSuccess = function(stream) {
        let options = {audioBitsPerSecond: 32000};

        let mediaRecorder = new MediaRecorder(stream, options);

        visualize(stream);

        record.onclick = function() {
            mediaRecorder.start();
            console.log(mediaRecorder.state);
            console.log("recorder started");
            record.style.background = "red";
            stop.disabled = false;
            record.disabled = true;
            const start = new Date();
            let i = 1;
            let requestData = setInterval(function() {
                mediaRecorder.requestData();
                if(++i>200)
                    return clearInterval(requestData);
                console.log(i);
                if(chunks.size >= 3200){
                    let blob = new Blob(chunks, { 'type' : 'audio/wav;codecs=pcm;rate=16000' });
                    console.log(blob.type);
                    console.log(blob.size);
                    chunks = [];
                    sendBlob(blob, sessionId, i);
                }
            }, 100);
        }//TODO: 78byte, 640 byte

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

            let blob = new Blob(chunks, { 'type' : 'audio/wav;codecs=pcm;rate=16000' });
            chunks = [];
            console.log(blob.type);
            console.log(blob.size);
            sendBlob(blob);

            let audioURL = window.URL.createObjectURL(blob);
            audio.src = audioURL;
            console.log("recorder stopped");

            deleteButton.onclick = function(e) {
                evtTgt = e.target;
                evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
            }

            clipLabel.onclick = function() {
                var existingName = clipLabel.textContent;
                var newClipName = prompt('Enter a new name for your sound clip?');
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