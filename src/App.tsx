
import './App.css';
import Sidebar from './components/Sidebar';
import AddressBar from './components/AddressBar';
import EditorComponent from './components/EditorComponent';
import StatusBar from './components/StatusBar';

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-area">
        <AddressBar />
        <EditorComponent />
        <StatusBar />
      </div>
    </div>
  );
}

export default App;
