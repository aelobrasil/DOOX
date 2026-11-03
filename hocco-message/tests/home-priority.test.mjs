import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemaHomeMarkup} from '../dist/cinema.mjs';
test('community is the first section after the hero and live messages are visible before offers',()=>{
 const html=cinemaHomeMarkup();
 const ids=['community-section','live-queue','cinema-sponsors'];
 const positions=ids.map(id=>html.indexOf(`id="${id}"`));
 assert.ok(positions.every(p=>p>0));
 assert.ok(positions[0]<positions[1]&&positions[1]<positions[2]);
 assert.ok(positions[2]<html.indexOf('class="streaming-shelf"'));
 assert.match(html,/<section class="cinema-live-queue"/);
 assert.equal((html.match(/id="community-send"/g)||[]).length,1);
 assert.match(html,/<\/section><section class="community-section/);
});
