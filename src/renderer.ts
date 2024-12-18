import { ipcRenderer } from 'electron';

const output = document.getElementById('output') as HTMLDivElement;

ipcRenderer.on('serial-data', (_event: Electron.IpcRendererEvent, data: string) => {
  const line = document.createElement('div');
  line.textContent = data;
  line.style.color = getRandomColor();
  output.appendChild(line);
});

function getRandomColor(): string {
  const colors: string[] = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
  return colors[Math.floor(Math.random() * colors.length)];
}
