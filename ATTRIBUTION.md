# Jazz Rhythm Attribution

The Jazz rhythm templates bundled in `script.js` are adapted from Jazz beat performances in the [Groove MIDI Dataset](https://magenta.tensorflow.org/datasets/groove), made available by Google LLC under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

The dataset was introduced by Jon Gillick, Adam Roberts, Jesse Engel, Douglas Eck, and David Bamman in “Learning to Groove with Inverse Sequence Transformations,” ICML 2019.

## Adaptation

The source recordings are labeled with primary style `jazz` and beat type `beat` in the dataset metadata. The pattern bank retains only General MIDI pitches 22, 26, 42, 44, 46, 51, 53, and 59, corresponding to the dataset's closed/open hi-hat and ride cymbal articulations. Source bars are separated into 3/4 and 4/4. Hits closer than 1/6 beat are thinned while preferring on-beat and triplet ride accents; patterns also leave the same minimum gap before barlines. Retained onsets are quantized to the nearest 1/12 quarter note, simultaneous hits are combined, and original pitches, velocities, and audio are not included. The app maps these events to its selected synthesized sound and groups patterns into meter-specific complexity bands.

## Source MIDI recordings

```text
groove/drummer1/session1/47_jazz_102_beat_4-4.mid
groove/drummer1/session1/48_jazz_93_beat_4-4.mid
groove/drummer1/session1/49_jazz_125_beat_4-4.mid
groove/drummer1/session1/4_jazz-funk_116_beat_4-4.mid
groove/drummer1/session1/50_jazz_125_beat_4-4.mid
groove/drummer1/session1/52_jazz_125_beat_4-4.mid
groove/drummer1/session1/5_jazz-funk_116_beat_4-4.mid
groove/drummer1/session1/75_jazz_125_beat_4-4.mid
groove/drummer1/session1/76_jazz-mediumfast_180_beat_4-4.mid
groove/drummer1/session1/77_jazz-mediumfast_180_beat_4-4.mid
groove/drummer1/session1/78_jazz-fast_290_beat_4-4.mid
groove/drummer1/session2/4_jazz_120_beat_3-4.mid
groove/drummer1/session2/5_jazz_200_beat_3-4.mid
groove/drummer1/session2/7_jazz-march_88_beat_4-4.mid
groove/drummer1/session2/8_jazz-march_176_beat_4-4.mid
groove/drummer1/session2/9_jazz-march_120_beat_4-4.mid
groove/drummer1/session3/2_jazz-swing_185_beat_4-4.mid
groove/drummer1/session3/4_jazz-linear_182_beat_4-4.mid
groove/drummer1/session3/5_jazz-linear_128_beat_4-4.mid
groove/drummer10/session1/10_jazz-swing_110_beat_4-4.mid
groove/drummer10/session1/1_jazz-swing_124_beat_4-4.mid
groove/drummer10/session1/2_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/3_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/4_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/5_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/6_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/7_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/8_jazz-swing_215_beat_4-4.mid
groove/drummer10/session1/9_jazz-swing_110_beat_4-4.mid
groove/drummer3/session1/15_jazz_120_beat_4-4.mid
groove/drummer3/session1/16_jazz_120_beat_4-4.mid
groove/drummer3/session1/22_jazz_120_beat_4-4.mid
groove/drummer3/session1/8_jazz_105_beat_4-4.mid
groove/drummer4/session1/2_jazz_158_beat_4-4.mid
groove/drummer4/session1/3_jazz-klezmer_152_beat_4-4.mid
groove/drummer7/session1/14_jazz_100_beat_4-4.mid
groove/drummer7/session1/15_jazz_112_beat_4-4.mid
groove/drummer7/session2/112_jazz-fusion_96_beat_4-4.mid
groove/drummer7/session2/113_jazz-fusion_96_beat_4-4.mid
groove/drummer7/session2/114_jazz-fusion_96_beat_4-4.mid
groove/drummer7/session2/115_jazz-fusion_96_beat_4-4.mid
```
