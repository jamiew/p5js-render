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
  silent?: boolean;
}

interface RenderResult {
  success: boolean;
  name: string;
  time: number;
  output: string[];
  error?: any;
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

async function renderSketch(config: RenderConfig): Promise<RenderResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const outputName = config.sketchName || 'custom-sketch';
  const outputDir = `output/${outputName}`;
  const startTime = Date.now();
  const output: string[] = [];
  
  const log = (message: string) => {
    if (config.silent) {
      output.push(message);
    } else {
      console.log(message);
    }
  };
  
  log(`🚀 Rendering ${outputName}...`);
  
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
    log(`  ✅ Rendered ${result.totalFrames} frames in ${result.durationMs}ms`);

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    // Save all frames
    log(`  💾 Saving ${result.frames.length} frames to ${outputDir}/...`);
    result.frames.forEach((frame: ApiFrameData) => {
      const frameNumber = String(frame.frameNumber).padStart(4, '0');
      const filename = path.join(outputDir, `frame_${frameNumber}.jpg`);
      fs.writeFileSync(filename, Buffer.from(frame.data, 'base64'));
    });

    log(`  📁 Frames saved to ${outputDir}/`);

    // Create video with FFmpeg - save in both locations
    const videoFileInDir = `${outputDir}/${outputName}-animation.mp4`;
    const videoFileInOutput = `output/${outputName}.mp4`;
    const ffmpegCmd = `ffmpeg -y -r ${finalConfig.frameRate} -i "${outputDir}/frame_%04d.jpg" -c:v libx264 -pix_fmt yuv420p "${videoFileInDir}"`;
    
    log(`  🎬 Creating video...`);
    try {
      execSync(ffmpegCmd, { stdio: 'pipe' });
      
      // Copy video to main output directory for easy browsing
      fs.copyFileSync(videoFileInDir, videoFileInOutput);
      
      log(`  ✅ Video created: ${videoFileInOutput}`);
      log(`  📁 Also saved: ${videoFileInDir}`);
      
      // Try to open the video
      if (!config.silent) {
        try {
          execSync('which open', { stdio: 'pipe' });
          execSync(`open "${videoFileInOutput}"`, { stdio: 'pipe' });
          log(`  📺 Opening video...`);
        } catch {
          log(`  💡 Video ready: ${videoFileInOutput}`);
        }
      } else {
        log(`  💡 Video ready: ${videoFileInOutput}`);
      }
    } catch (error) {
      log(`  ❌ FFmpeg error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      log(`  💡 Manual command: ${ffmpegCmd}`);
    }

    const time = Date.now() - startTime;
    return { success: true, name: outputName, time, output };

  } catch (error) {
    const time = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error rendering ${outputName}: ${errorMsg}`);
    return { success: false, name: outputName, time, output, error };
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

// Live progress tracking for parallel rendering
interface SketchProgress {
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  spinner: ReturnType<typeof createSpinner>;
}

function displayProgressDashboard(sketches: SketchProgress[]) {
  // Clear screen and reset cursor
  process.stdout.write('\x1B[2J\x1B[0f');
  
  console.log('🎨 Rendering all example sketches in parallel...\n');
  
  sketches.forEach(sketch => {
    let elapsed = 0;
    let timeStr = '';
    
    if (sketch.status === 'completed' || sketch.status === 'failed') {
      // Show final time for completed/failed sketches
      elapsed = sketch.endTime! - sketch.startTime!;
      timeStr = ` (${formatTime(elapsed)})`;
    } else if (sketch.startTime) {
      // Show running time for active sketches
      elapsed = Date.now() - sketch.startTime;
      timeStr = ` (${formatTime(elapsed)})`;
    }
    
    const statusIcon = {
      waiting: '⏳',
      running: sketch.spinner.frame(),
      completed: '✅',
      failed: '❌'
    }[sketch.status];
    
    const dots = sketch.status === 'running' ? sketch.spinner.dots(elapsed) : '';
    
    console.log(`  ${statusIcon} ${sketch.name.padEnd(20)} ${sketch.status}${dots}${timeStr}`);
  });
  
  const running = sketches.filter(s => s.status === 'running').length;
  const completed = sketches.filter(s => s.status === 'completed').length;
  const failed = sketches.filter(s => s.status === 'failed').length;
  
  console.log(`\n📊 Progress: ${completed}✅ ${failed}❌ ${running}🔄 / ${sketches.length} total`);
}

async function renderAllExamples(): Promise<void> {
  // Dynamically discover all sketches in examples directory
  const examplesDir = './examples';
  const files = fs.readdirSync(examplesDir).filter(file => file.endsWith('.js'));
  
  const examples = files.map(file => {
    const name = file.replace('.js', '');
    // Use sane defaults for all sketches
    return { name, duration: 3, frameRate: 24 };
  });

  const overallStartTime = Date.now();
  const completedResults: RenderResult[] = [];
  
  // Initialize progress tracking
  const sketches: SketchProgress[] = examples.map(ex => ({
    name: ex.name,
    status: 'waiting' as const,
    spinner: createSpinner()
  }));
  
  // Start live progress display
  const progressInterval = setInterval(() => {
    displayProgressDashboard(sketches);
  }, 200);
  
  // Create promises for all renders
  const renderPromises = examples.map(async (example, index) => {
    const sketch = sketches[index];
    
    // Update status to running
    sketch.status = 'running';
    sketch.startTime = Date.now();
    
    try {
      const result = await renderSketch({
        sketchName: example.name,
        frameRate: example.frameRate,
        duration: example.duration,
        silent: true // Capture output for later display
      });
      
      sketch.status = result.success ? 'completed' : 'failed';
      sketch.endTime = Date.now();
      
      // Display completed sketch output immediately
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 OUTPUT FOR: ${example.name.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);
      result.output.forEach(line => console.log(line));
      console.log(`⏱️  Completed in ${formatTime(result.time)}\n`);
      
      completedResults.push(result);
      return result;
    } catch (error) {
      sketch.status = 'failed';
      sketch.endTime = Date.now();
      
      const result: RenderResult = {
        success: false,
        name: example.name,
        time: Date.now() - sketch.startTime!,
        output: [`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        error
      };
      
      completedResults.push(result);
      return result;
    }
  });
  
  // Wait for all renders to complete
  await Promise.all(renderPromises);
  
  // Stop progress display
  clearInterval(progressInterval);
  
  // Clear screen one final time and show summary
  process.stdout.write('\x1B[2J\x1B[0f');
  
  const totalTime = Date.now() - overallStartTime;
  const successful = completedResults.filter(r => r.success);
  const failed = completedResults.filter(r => !r.success);
  
  console.log('🎯 PARALLEL RENDERING SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successful.length}/${completedResults.length}`);
  console.log(`❌ Failed: ${failed.length}/${completedResults.length}`);
  console.log(`⏱️  Total time: ${formatTime(totalTime)} (parallel execution!)\n`);
  
  if (successful.length > 0) {
    console.log('📊 Individual Render Times:');
    successful.forEach(r => {
      const example = examples.find(e => e.name === r.name)!;
      const frames = example.frameRate * example.duration;
      const frameTime = r.time / frames;
      console.log(`  ✅ ${r.name.padEnd(20)} ${formatTime(r.time).padStart(8)} (${frameTime.toFixed(1)}ms/frame)`);
    });
    console.log('');
    
    console.log('📺 Created videos:');
    successful.forEach(r => {
      console.log(`  • output/${r.name}.mp4`);
    });
    console.log('');
  }
  
  if (failed.length > 0) {
    console.log('💥 Failed renders:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.name.padEnd(20)} ${formatTime(r.time).padStart(8)}`);
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
  
  const result = await renderSketch(config);
  if (!result.success) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { renderSketch, renderAllExamples };