import { nonMaximumSuppression } from './postprocessor';
import type { Detection } from './postprocessor';

const mockDetections: Detection[] = [
  {
    label: 'person',
    score: 0.9,
    box: { xmin: 0.1, ymin: 0.1, xmax: 0.5, ymax: 0.5 }
  },
  {
    label: 'person',
    score: 0.85,
    box: { xmin: 0.12, ymin: 0.12, xmax: 0.52, ymax: 0.52 } // Overlapping
  },
  {
    label: 'dog',
    score: 0.7,
    box: { xmin: 0.6, ymin: 0.6, xmax: 0.9, ymax: 0.9 } // Separate
  }
];

export function testNMS() {
  console.log('Testing NMS...');
  const result = nonMaximumSuppression(mockDetections, 0.45);
  
  if (result.length === 2) {
    console.log('✅ NMS Test Passed: Correctly filtered overlapping box.');
  } else {
    console.error(`❌ NMS Test Failed: Expected 2 results, got ${result.length}`);
  }
}

// Odkomentuj poniżej jeśli chcesz uruchomić w konsoli przez ts-node/vite-node
// testNMS();
