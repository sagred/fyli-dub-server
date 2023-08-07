

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { Configuration, OpenAIApi } from "openai";
import shortid from "shortid"
import axios from "axios"

const configuration = new Configuration({
 apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);

async function splitVideoToAudioAndVideo(inputVideoPath: string): Promise<[string, string]> {
  try {
    const outputAudioPath = path.join(__dirname, `output_audio_${shortid.generate()}.mp3`);
    const outputVideoPath = path.join(__dirname, `output_video_${shortid.generate()}.mp4`);

    // Split video into audio and video layers
    await runCommand(`ffmpeg -i "${inputVideoPath}" -vn "${outputAudioPath}" -an "${outputVideoPath}"`);

    return [outputAudioPath, outputVideoPath];
  } catch (error: any) {
    throw new Error(`Error splitting video: ${error.message}`);
  }
}

async function getAudioTranscription(inputAudioPath: string) {

  const resp = await openai.createTranslation(
    //@ts-expect-error
    fs.createReadStream(inputAudioPath),
    "whisper-1"
  );
 
  if(resp.status === 200) {
    return resp.data.text
  }

  return resp
}

async function getAudioFromTranscription(transcription: string): Promise<string> {

  const headers = {
    'xi-api-key': process.env.EL_KEY,
  };
  
  const data = {
    text: transcription,
    voice_settings: {
      stability: 0,
      similarity_boost: 0,
    },
  };

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/7zf3S9ZDwAeeBaZNIuAw`,
      data,
      { headers, responseType: 'arraybuffer' }
    );
  
    const audioFilePath = path.join(__dirname, `new_audio_${shortid.generate()}.mp3`);
    fs.writeFileSync(audioFilePath, response.data);
  
    console.log('Audio file saved at:', audioFilePath);

    return audioFilePath
 
}

async function mergeAudioWithVideo(inputVideoPath: string, inputAudioPath: string, outputPath: string): Promise<void> {
  try {
    // Merge new audio with the video
    await runCommand(`ffmpeg -i "${inputVideoPath}" -i "${inputAudioPath}" -c:v copy -c:a aac -strict experimental "${outputPath}"`);
  } catch (error: any) {
    throw new Error(`Error merging audio with video: ${error.message}`);
  }
}

async function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
//@ts-expect-error

    exec(command, (error: any, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  try {

    const inputVideoPath = path.join(__dirname, 'input', 'video.mp4');
    const outputMergedVideoPath = path.join(__dirname, 'output', `merged_video_${shortid.generate()}.mp4`);

    const [audioPath, videoPath] = await splitVideoToAudioAndVideo(inputVideoPath);

    //video conversion from hindi audio
    const transcription: string | any = await getAudioTranscription(audioPath);
    console.log('Video Transcription:', transcription);

    const newAudioPath = await getAudioFromTranscription(transcription)

    await mergeAudioWithVideo(videoPath, newAudioPath, outputMergedVideoPath);

    console.log('Video with new audio has been rendered:', outputMergedVideoPath);
  } catch (error: any) {
    console.error('An error occurred:', error.message);
  }
}

main();
