import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {React, renderToStaticMarkup, bundleComponent} from './helpers/render.mjs';

const component = await bundleComponent('next-app/components/profile-workspace.tsx', {plugins: [{name: 'profile-sidebar-fixture', setup(build) {
  build.onLoad({filter: /\/workspace\.jsx$/}, () => ({contents: 'export const useWorkspace=()=>({demo:true,demoEpoch:0});', loader: 'js'}));
  build.onLoad({filter: /\/application-profile-context\.tsx$/}, () => ({contents: 'export const useApplicationProfile=()=>({}); export const ApplicationProfileProvider=({children})=>children;', loader: 'js'}));
  build.onLoad({filter: /\/profile-surface\.tsx$/}, () => ({contents: 'export const profileStyles={sidebar:"sidebar",profileLayout:"profileLayout",profileContent:"profileContent"}; export default ({children})=>children;', loader: 'js'}));
  build.onLoad({filter: /\/profile-settings\.tsx$/}, () => ({contents: 'export const ProfileSwitcher=()=>null; export const EligibilitySettings=()=>null; export const WritingStyles=()=>null;', loader: 'js'}));
  build.onLoad({filter: /\/(board-return|profile-editor|profile-documents|appearance-settings|discovery-setup|circle-agent-settings|preferences)\.tsx$/}, () => ({contents: 'export default ()=>null;', loader: 'js'}));
  build.onLoad({filter: /\/feature-scope\.mjs$/}, () => ({contents: 'export const EXTRA_FEATURES_ENABLED=globalThis.extraFeatures;', loader: 'js'}));
}}]});

test('profile sidebar places Saved Preferences between My Agent and Appearance', () => {
  const Component = component({extraFeatures: true});
  const html = renderToStaticMarkup(React.createElement(Component));
  const navigation = html.match(/<nav[^>]*aria-label="Profile sections"[^>]*>(.*?)<\/nav>/s)[1];
  assert.deepEqual([...navigation.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(match => match[1]), ['About me', 'Job preferences', 'My Agent', 'Saved Preferences', 'Appearance']);
  assert.match(navigation, /aria-pressed="true"/);
  assert.match(html, /<option value="saved-preferences">Saved Preferences<\/option>/);
});

test('Saved Preferences remains reachable without enabling paused Appearance features', () => {
  const Component = component({extraFeatures: false});
  const html = renderToStaticMarkup(React.createElement(Component));
  assert.match(html, /Saved Preferences/);
  assert.doesNotMatch(html, />Appearance</);
});

test('profile sidebar provides responsive layout and keyboard focus styles', async () => {
  const css = await readFile(new URL('../next-app/components/profile-surface.module.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 208px minmax\(0, 1fr\)/);
  assert.match(css, /\.sidebar button:focus-visible/);
  assert.match(css, /\.sidebar\s*\{\s*display: none/);
});
