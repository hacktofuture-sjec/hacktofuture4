import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { scenario } = await req.json();
    
    // We can pass scenario as an environment variable or argument to the python script
    // For now, let's just run the pipeline and capture its output
    // We adjust the path to reach the root directory from dashboard/src/api/run-pipeline
    const rootDir = path.join(process.cwd(), '..');
    const pythonPath = path.join(rootDir, 'venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(rootDir, 'pipeline', 'langgraph_pipeline.py');

    // Run the pipeline
    // In a real app, we'd pass raw data here. For simulation, we'll let the script use its internal scenarios.
    const { stdout, stderr } = await execPromise(`"${pythonPath}" "${scriptPath}"`, {
      cwd: rootDir,
      env: { ...process.env, SCENARIO_OVERRIDE: scenario, OUTPUT_FORMAT: 'json' }
    });

    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    // Parse the output. Our script prints JSON-like block for sub-models and then the SITREP.
    // Let's modify the python script to output clean JSON if a flag is passed.
    // For now, we'll just return the raw stdout or parse it roughly.
    
    return NextResponse.json({ 
      raw: stdout,
      message: "Pipeline executed successfully"
    });

  } catch (error: any) {
    console.error('Pipeline error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
