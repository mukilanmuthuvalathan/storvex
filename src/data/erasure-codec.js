const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let value = 1;
for (let index = 0; index < 255; index += 1) {
  EXP[index] = value;
  LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255];

const multiply = (left, right) => left === 0 || right === 0 ? 0 : EXP[LOG[left] + LOG[right]];
const inverse = (number) => {
  if (number === 0) throw new Error('Cannot invert zero in GF(256)');
  return EXP[255 - LOG[number]];
};
const power = (base, exponent) => exponent === 0 ? 1 : EXP[(LOG[base] * exponent) % 255];

function invertMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (_, columnIndex) => rowIndex === columnIndex ? 1 : 0),
  ]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    while (pivot < size && augmented[pivot][column] === 0) pivot += 1;
    if (pivot === size) throw new Error('Erasure matrix is singular');
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const scale = inverse(augmented[column][column]);
    for (let index = 0; index < size * 2; index += 1) augmented[column][index] = multiply(augmented[column][index], scale);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      if (!factor) continue;
      for (let index = 0; index < size * 2; index += 1) augmented[row][index] ^= multiply(factor, augmented[column][index]);
    }
  }
  return augmented.map((row) => row.slice(size));
}

export class ErasureCodec {
  constructor(dataShards = 10, parityShards = 4) {
    this.dataShards = dataShards;
    this.parityShards = parityShards;
    this.totalShards = dataShards + parityShards;
    this.matrix = Array.from({ length: this.totalShards }, (_, row) => {
      if (row < dataShards) return Array.from({ length: dataShards }, (_, column) => row === column ? 1 : 0);
      const base = row - dataShards + 1;
      return Array.from({ length: dataShards }, (_, column) => power(base, column));
    });
  }

  encode(buffer) {
    const shardSize = Math.ceil(buffer.length / this.dataShards);
    const shards = Array.from({ length: this.totalShards }, () => Buffer.alloc(shardSize));
    for (let index = 0; index < this.dataShards; index += 1) {
      const start = index * shardSize;
      if (start < buffer.length) buffer.copy(shards[index], 0, start, Math.min(buffer.length, (index + 1) * shardSize));
    }
    for (let row = this.dataShards; row < this.totalShards; row += 1) {
      for (let dataIndex = 0; dataIndex < this.dataShards; dataIndex += 1) {
        const coefficient = this.matrix[row][dataIndex];
        for (let offset = 0; offset < shardSize; offset += 1) shards[row][offset] ^= multiply(coefficient, shards[dataIndex][offset]);
      }
    }
    return { shards, shardSize, originalSize: buffer.length };
  }

  decode(available, originalSize) {
    if (available.length < this.dataShards) throw new Error(`Need at least ${this.dataShards} valid fragments`);
    const selected = available.slice(0, this.dataShards);
    const inverseRows = invertMatrix(selected.map(({ index }) => this.matrix[index]));
    const shardSize = selected[0].buffer.length;
    const data = Array.from({ length: this.dataShards }, () => Buffer.alloc(shardSize));
    for (let output = 0; output < this.dataShards; output += 1) {
      for (let input = 0; input < this.dataShards; input += 1) {
        const coefficient = inverseRows[output][input];
        for (let offset = 0; offset < shardSize; offset += 1) data[output][offset] ^= multiply(coefficient, selected[input].buffer[offset]);
      }
    }
    return Buffer.concat(data).subarray(0, originalSize);
  }
}
