"""Resolve stock presets without copying the upstream tuner or changing its algorithms."""
import argparse,json,pathlib,sys
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--config',required=True);p.add_argument('--use',choices=['chat','coding'],default='chat');p.add_argument('--off',action='store_true');a=p.parse_args()
sys.path.insert(0,a.source)
from strata_control import presets
cfg=json.loads(pathlib.Path(a.config).read_text())
if a.off:out,info=cfg,{'applied':False}
else:out,info=presets.overlay(cfg,use=a.use)
print('DSH_RESULT='+json.dumps({'config':out,'preset':info}),flush=True)
