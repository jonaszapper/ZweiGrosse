import { render } from 'preact';
import { content } from './content/browser';
import { App } from './ui/App';
import './ui/style.css';

render(<App content={content} />, document.getElementById('app')!);
