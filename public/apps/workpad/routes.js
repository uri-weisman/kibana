import * as workpadService from '../../lib/workpad_service';
import { notify } from '../../lib/notify';
import { getDefaultWorkpad } from '../../state/defaults';
import { setWorkpad } from '../../state/actions/workpad';
import { setAssets, resetAssets } from '../../state/actions/assets';
import { gotoPage } from '../../state/actions/pages';
import { getWorkpad } from '../../state/selectors/workpad';
import { WorkpadApp } from './workpad_app';

export const routes = [
  {
    path: '/workpad',
    children: [
      {
        name: 'createWorkpad',
        path: '/create',
        action: dispatch => async ({ router }) => {
          // TODO: handle the failed creation state
          const newWorkpad = getDefaultWorkpad();
          await workpadService.create(newWorkpad);
          dispatch(setWorkpad(newWorkpad));
          dispatch(resetAssets());
          router.redirectTo('loadWorkpad', { id: newWorkpad.id, page: 1 });
        },
        meta: {
          component: WorkpadApp,
        },
      },
      {
        name: 'loadWorkpad',
        path: '/:id(/page/:page)',
        action: (dispatch, getState) => async ({ params, router }) => {
          // load workpad if given a new id via url param
          const currentWorkpad = getWorkpad(getState());
          if (params.id !== currentWorkpad.id) {
            try {
              const { assets, ...workpad } = await workpadService.get(params.id);
              dispatch(setWorkpad(workpad));
              dispatch(setAssets(assets));
            } catch (fetchErr) {
              notify.error(fetchErr);
            }
          }

          // fetch the workpad again, to get changes
          const workpad = getWorkpad(getState());
          const pageNumber = parseInt(params.page, 10);

          // no page provided, append current page to url
          if (isNaN(pageNumber)) {
            return router.redirectTo('loadWorkpad', { id: workpad.id, page: workpad.page + 1 });
          }

          // set the active page using the number provided in the url
          const pageIndex = pageNumber - 1;
          if (pageIndex !== workpad.page) dispatch(gotoPage(pageIndex));
        },
        meta: {
          component: WorkpadApp,
        },
      },
    ],
  },
];
