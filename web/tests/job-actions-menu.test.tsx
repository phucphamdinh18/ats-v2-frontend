import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Menu from '../components/job-actions-menu';
afterEach(cleanup);
const a={id:'a',title:'Embedded Engineer',job_code:'A',status:'OPEN'},b={id:'b',title:'AI Engineer',job_code:'B',status:'DRAFT'};
it('edits the currently selected Job and never creates a Job when editing',()=>{
 const edit=vi.fn(),create=vi.fn();const view=render(<Menu job={a} en onEdit={edit} onCreate={create}/>);
 fireEvent.click(screen.getByRole('button',{name:'Job actions'}));
 view.rerender(<Menu job={b} en onEdit={edit} onCreate={create}/>);
 expect(screen.getByRole('menuitem',{name:/Edit Job/}).textContent).toContain('AI Engineer');
 fireEvent.click(screen.getByRole('menuitem',{name:/Edit Job/}));expect(edit).toHaveBeenCalledWith(b);expect(create).not.toHaveBeenCalled();expect(screen.queryByRole('menu')).toBeNull();
});
it('supports keyboard navigation and Escape restores focus',async()=>{
 render(<Menu job={a} en onEdit={vi.fn()} onCreate={vi.fn()}/>);
 const trigger=screen.getByRole('button',{name:'Job actions'});
 fireEvent.keyDown(trigger,{key:'ArrowDown'});
 const add=screen.getByRole('menuitem',{name:'Add Job'}),edit=screen.getByRole('menuitem',{name:/Edit Job/});
 await waitFor(()=>expect(document.activeElement).toBe(add));
 fireEvent.keyDown(add,{key:'ArrowDown'});expect(document.activeElement).toBe(edit);
 fireEvent.keyDown(edit,{key:'Escape'});expect(screen.queryByRole('menu')).toBeNull();expect(document.activeElement).toBe(trigger);
});
it('closes when clicking outside and disables edit without a selected editable Job',()=>{
 const view=render(<Menu job={null} en onEdit={vi.fn()} onCreate={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Job actions'}));expect(screen.getByRole('menuitem',{name:/Edit Job/}).hasAttribute('disabled')).toBe(true);
 fireEvent.pointerDown(document.body);expect(screen.queryByRole('menu')).toBeNull();
 view.rerender(<Menu job={{...a,status:'CLOSED'}} en onEdit={vi.fn()} onCreate={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Job actions'}));expect(screen.getByRole('menuitem',{name:/Edit Job/}).hasAttribute('disabled')).toBe(true);
});
