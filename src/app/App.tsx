import '../styles/fleet.css';
import { FleetCommandCenter } from './FleetCommandCenter';
import { ThemeProvider } from '../features/theme/ThemeProvider';

export function App() {
  return <ThemeProvider><span role="banner" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Printer Fleet Command Center</span><FleetCommandCenter /></ThemeProvider>;
}
