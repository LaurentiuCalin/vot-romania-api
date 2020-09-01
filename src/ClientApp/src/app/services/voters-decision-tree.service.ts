import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { catchError, shareReplay, filter, map, mapTo } from 'rxjs/operators';

export interface OperatorDecisionTree {
  [key: string]: OperatorTreeNode;
  initial: Required<Pick<OperatorTreeNode, 'id' | 'options'>>;
  error?: any;
}

export interface OperatorTreeNode {
  id: string;
  label?: string;
  options?: string[];
  votersOptionId?: number;
  text?: string;
}

export interface OperatorTreeNodeWithOptions extends OperatorTreeNode {
  options: string[];
}

export function isInitialDecision(previousBranchIds: string[]): boolean {
  return (
    previousBranchIds.includes('initial') && previousBranchIds.length === 1
  );
}

export function treeIsErrorFree(tree): boolean {
  return !tree.error;
}

export function nodeHasOptions(node): node is OperatorTreeNodeWithOptions {
  return !!node.options;
}

export interface State {
  previousBranchIds: string[];
  currentBranchId: string;
}


@Injectable({
  providedIn: 'root'
})
export class VotersDecisionTreeService {


  getDecisionTree$(): Observable<OperatorDecisionTree> {
    const data: OperatorDecisionTree = {
      'initial': {
        id: 'initial',
        options: [
          '0',
          '1'
        ]
      },
      '0': {
        id: '0',
        label: 'Ești cetățean român',
        options: [
          '00',
          '01'
        ]
      },
      '1': {
        id: '1',
        label: 'Ești cetățean al unei alte țări din Uniunea Europeană',
        options: [
          '10',
          '11'
        ]
      },
      '00': {
        id: '00',
        label: 'Nu te vei afla în România pe 27 septembrie',
        options: [
          '000'
        ]
      },
      '01': {
        id: '01',
        label: 'Te vei afla în Romania pe 27 septembrie',
        options: [
          '010',
          '011'
        ]
      },
      '000': {
        id: '000',
        votersOptionId: 1
      },
      '010': {
        id: '010',
        label: 'Locuiești la adresa din buletin',
        options: [
          '0100'
        ]
      },
      '0100': {
        id: '0100',
        votersOptionId: 2
      },
      '011': {
        id: '011',
        label: 'Locuiești la altă adresă decât cea din buletin',
        options: [
          '0110',
          '0111'
        ]
      },
      '0110': {
        id: '0110',
        label: 'Ai pe spatele buletinului un autocolant cu viza de flotant',
        options: [
          '01100'
        ]
      },
      '01100': {
        id: '01100',
        votersOptionId: 3
      },
      '0111': {
        id: '0111',
        label: 'Nu ai viză de flotant pe spatele buletinului',
        options: [
          '01110',
          '01111'
        ]
      },
      '01110': {
        id: '01110',
        label: 'Te poate lua cineva în spațiu',
        options: [
          '011100'
        ]
      },
      '011100': {
        id: '011100',
        votersOptionId: 4
      },
      '01111': {
        id: '01111',
        label: 'Nu ai pe cineva care te poate lua în spațiu',
        options: [
          '011110'
        ]
      },
      '011110': {
        id: '011110',
        votersOptionId: 5
      },
      '10': {
        id: '10',
        label: 'Ești în evidența Inspectoratului General pentru Imigrări',
        options: [
          '100',
          '101'
        ]
      },
      '100': {
        id: '100',
        label: 'Adresa la care locuiești nu se va schimba în intervalul 3-27 septembrie',
        options: [
          '1010'
        ]
      },
      '1000': {
        id: '1000',
        votersOptionId: 6
      },
      '101': {
        id: '101',
        label: 'Adresa la care locuiești nu se va schimba în intervalul 3-27 septembrie',
        options: [
          '1010'
        ]
      },
      '1010': {
        id: '1000',
        votersOptionId: 7
      },
      '11': {
        id: '11',
        label: 'Nu ești în evidența Inspectoratului General pentru Imigrări',
        options: [
          '110',
        ]
      },
      '110': {
        id: '110',
        votersOptionId: 8
      },
    };

    return of(data);
  }

  private initialState: State = {
    previousBranchIds: ['initial'],
    currentBranchId: 'initial'
  };
  private state$ = new BehaviorSubject<State>(this.initialState);
  private tree$: Observable<
    OperatorDecisionTree
  > = this.getDecisionTree$().pipe(
    catchError(error => of(error)), // This helps if the JSON for some reason fails to get fetched
    shareReplay()
  );

  currentSentence$: Observable<string> = combineLatest(
    this.tree$,
    this.state$
  ).pipe(
    filter(([tree]) => treeIsErrorFree(tree)),
    map(([tree, { previousBranchIds }]) =>
      isInitialDecision(previousBranchIds)
        ? 'Începe prin a alege una din opțiunile de mai jos'
        : `${previousBranchIds
          .map(entityId => {
            return tree[entityId].label;
          })
          .join(' ')}...`.trim()
    )
  );

  options$: Observable<(OperatorTreeNode)[]> = combineLatest(
    this.tree$,
    this.state$
  ).pipe(
    filter(([tree, state]) => {
      return (
        treeIsErrorFree(tree) &&
        !!tree[state.currentBranchId] &&
        !!tree[state.currentBranchId].options
      );
    }),
    map(([tree, state]) => {
      // Project is currently using TypeScript 2.9.2
      // With TS 3.1+ this can be done better if we map to [tree, node] and typeguard with a tuple in a filter
      // filter((a): a is [OperatorDecisionTree, OperatorTreeNodeWithOptions] => !a[0].error && !!a[1].options)
      const node = tree[state.currentBranchId];
      return nodeHasOptions(node)
        ? node.options.map(option => tree[option])
        : tree['initial'].options.map(option => tree[option]);
    })
  );

  isBeyondInitialQuestion$: Observable<boolean> = this.state$.pipe(
    map(({ currentBranchId }) => currentBranchId !== 'initial')
  );

  // This helps if the JSON for some reason fails to get fetched
  hasError$ = this.tree$.pipe(
    filter(tree => !!tree.error),
    mapTo(true)
  );

  constructor() { }

  private get snapShot(): State {
    return this.state$.getValue();
  }

  selectOption(optionId: string): void {
    this.state$.next({
      previousBranchIds: [...this.snapShot.previousBranchIds, optionId],
      currentBranchId: optionId
    });
  }

  back(): void {
    const previousOptionId = this.snapShot.previousBranchIds[
      this.snapShot.previousBranchIds.length - 2
    ];

    if (previousOptionId) {
      this.state$.next({
        previousBranchIds: [
          ...this.snapShot.previousBranchIds.slice(
            0,
            this.snapShot.previousBranchIds.length - 1
          )
        ],
        currentBranchId: previousOptionId
      });
    }
  }

  startOver(): void {
    this.state$.next(this.initialState);
  }
}