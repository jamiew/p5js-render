import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { RenderApiResponse, ApiFrameData } from './types.js';

interface RenderConfig {
  sketchName?: string;
  sketchUrl?: string;
  sketchCode?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  duration?: number;
  serverUrl?: string;
}

const DEFAULT_CONFIG = {
  width: 800,
  height: 600,
  frameRate: 24,
  duration: 3,
  serverUrl: 'http://localhost:3000'
};

async function loadSketchCode(config: RenderConfig): Promise<string> {
  if (config.sketchCode) {
    return config.sketchCode;
  }
  
  if (config.sketchUrl) {
    console.log(`📥 Fetching sketch from URL: ${config.sketchUrl}`);
    const response = await fetch(config.sketchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sketch: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  }
  
  if (config.sketchName) {
    const sketchPath = `./examples/${config.sketchName}.js`;
    if (!fs.existsSync(sketchPath)) {
      throw new Error(`Sketch file not found: ${sketchPath}`);
    }
    console.log(`📁 Loading sketch: ${sketchPath}`);
    return fs.readFileSync(sketchPath, 'utf8');
  }
  
  throw new Error('Must provide sketchName, sketchUrl, or sketchCode');
}

async function renderSketch(config: RenderConfig): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const outputName = config.sketchName || 'custom-sketch';
  const outputDir = `output/${outputName}`;
  
  console.log(`🚀 Rendering ${outputName}...`);
  
  try {
    const code = await loadSketchCode(config);
    
    const testData = {
      code,
      width: finalConfig.width,
      height: finalConfig.height,
      frameRate: finalConfig.frameRate,
      durationSeconds: finalConfig.duration
    };

    const response = await fetch(`${finalConfig.serverUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as RenderApiResponse;
    console.log(`  ✅ Rendered ${result.totalFrames} frames in ${result.durationMs}ms`);

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    // Save all frames
    console.log(`  💾 Saving ${result.frames.length} frames to ${outputDir}/...`);
    result.frames.forEach((frame: ApiFrameData) => {
      const frameNumber = String(frame.frameNumber).padStart(4, '0');
      const filename = path.join(outputDir, `frame_${frameNumber}.png`);
      fs.writeFileSync(filename, Buffer.from(frame.data, 'base64'));
    });

    console.log(`  📁 Frames saved to ${outputDir}/`);

    // Create video with FFmpeg
    const videoFile = `${outputDir}/${outputName}-animation.mp4`;
    const ffmpegCmd = `ffmpeg -y -r ${finalConfig.frameRate} -i "${outputDir}/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p "${videoFile}"`;
    
    console.log(`  🎬 Creating video...`);
    try {
      execSync(ffmpegCmd, { stdio: 'pipe' });
      console.log(`  ✅ Video created: ${videoFile}`);
      
      // Try to open the video
      try {
        execSync('which open', { stdio: 'pipe' });
        execSync(`open "${videoFile}"`, { stdio: 'pipe' });
        console.log(`  📺 Opening video...`);
      } catch {
        console.log(`  💡 Video ready: ${videoFile}`);
      }
    } catch (error) {
      console.error(`  ❌ FFmpeg error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`  💡 Manual command: ${ffmpegCmd}`);
    }

  } catch (error) {
    console.error(`❌ Error rendering ${outputName}:`, error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Loading animation utilities
function createSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  return {
    frame: () => frames[i++ % frames.length],
    dots: (elapsed: number) => '.'.repeat(Math.floor(elapsed / 1000) % 4)
  };
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

async function renderAllExamples(): Promise<void> {
  console.log('🎨 Rendering all example sketches...\n');

  const examples = [
    { name: 'rotating-cubes', duration: 3, frameRate: 24 },
    { name: 'plasma-field', duration: 4, frameRate: 30 },
    { name: 'fractal-tree', duration: 3, frameRate: 24 },
    { name: 'psychedelic-spiral', duration: 4, frameRate: 30 },
    { name: 'liquid-morphing', duration: 5, frameRate: 24 },
    { name: 'oscilloscope-simple', duration: 3, frameRate: 24 },
    { name: 'particle-galaxy', duration: 5, frameRate: 24 },
    { name: 'tunnel-simple', duration: 3, frameRate: 24 }
  ];

  const results: Array<{ success: boolean; name: string; time?: number; error?: any }> = [];
  const overallStartTime = Date.now();
  
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    const spinner = createSpinner();
    const startTime = Date.now();
    
    // Start loading animation
    const progressText = `[${i + 1}/${examples.length}] 🚀 Rendering ${example.name}`;
    let animationInterval: NodeJS.Timeout;
    
    const startAnimation = () => {
      let elapsed = 0;
      animationInterval = setInterval(() => {
        elapsed += 200;
        const spinnerFrame = spinner.frame();
        const dots = spinner.dots(elapsed);
        process.stdout.write(`\r${progressText} ${spinnerFrame}${dots}`);
      }, 200);
    };
    
    startAnimation();
    
    try {
      await renderSketch({
        sketchName: example.name,
        frameRate: example.frameRate,
        duration: example.duration
      });
      const renderTime = Date.now() - startTime;
      clearInterval(animationInterval);
      process.stdout.write(`\r${progressText} ✅ Completed in ${formatTime(renderTime)}\n`);
      results.push({ success: true, name: example.name, time: renderTime });
    } catch (error) {
      const renderTime = Date.now() - startTime;
      clearInterval(animationInterval);
      process.stdout.write(`\r${progressText} ❌ Failed after ${formatTime(renderTime)}\n`);
      results.push({ success: false, name: example.name, time: renderTime, error });
    }
    console.log('');
  }
  
  const totalTime = Date.now() - overallStartTime;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('🎯 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log(`⏱️  Total time: ${formatTime(totalTime)}\n`);
  
  if (successful.length > 0) {
    console.log('📊 Render Times:');
    successful.forEach(r => {
      const frames = examples.find(e => e.name === r.name)!.frameRate * examples.find(e => e.name === r.name)!.duration;
      const frameTime = r.time! / frames;
      console.log(`  ✅ ${r.name.padEnd(20)} ${formatTime(r.time!).padStart(8)} (${frameTime.toFixed(1)}ms/frame)`);
    });
    console.log('');
    
    console.log('📺 Created videos:');
    successful.forEach(r => {
      console.log(`  • output/${r.name}/${r.name}-animation.mp4`);
    });
    console.log('');
  }
  
  if (failed.length > 0) {
    console.log('💥 Failed renders:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.name.padEnd(20)} ${formatTime(r.time!).padStart(8)}`);
    });
    console.log('');
  }
  
  // Try to open output directory
  try {
    execSync('which open', { stdio: 'pipe' });
    execSync('open output/', { stdio: 'pipe' });
    console.log('📂 Opening output directory...');
  } catch {
    console.log('💡 Check the output/ directory for all rendered videos');
  }
}

// CLI argument parsing
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  npm run render <sketch-name>              # Render example sketch
  npm run render:url <url>                  # Render sketch from URL
  npm run render:code "<p5js-code>"         # Render inline code
  npm run render:all                        # Render all examples

Options can be set via environment variables:
  WIDTH=1920 HEIGHT=1080 FRAMERATE=60 DURATION=5 npm run render rotating-cubes

Examples:
  npm run render rotating-cubes
  npm run render:url https://gist.githubusercontent.com/user/123/raw/sketch.js
  npm run render:code "function setup() { createCanvas(400,400); } function draw() { background(255,0,0); }"
    `);
    return;
  }

  const command = args[0];
  
  if (command === 'all') {
    await renderAllExamples();
    return;
  }
  
  const config: RenderConfig = {};
  
  if (process.env.WIDTH) config.width = Number(process.env.WIDTH);
  if (process.env.HEIGHT) config.height = Number(process.env.HEIGHT);
  if (process.env.FRAMERATE) config.frameRate = Number(process.env.FRAMERATE);
  if (process.env.DURATION) config.duration = Number(process.env.DURATION);
  if (process.env.SERVER_URL) config.serverUrl = process.env.SERVER_URL;
  
  if (command === 'url') {
    config.sketchUrl = args[1];
    config.sketchName = 'url-sketch';
  } else if (command === 'code') {
    config.sketchCode = args[1];
    config.sketchName = 'inline-sketch';
  } else {
    config.sketchName = command;
  }
  
  await renderSketch(config);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { renderSketch, renderAllExamples };