import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { ChatterComponent } from './chatter.component';
import { ChatterService } from 'src/app/application-services/chatter.service';
import { SocketService } from 'src/app/shared/system-service/socket.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { IUserData } from './model/chat.interfaces';

describe('ChatterComponent', () => {
  let component: ChatterComponent;
  let fixture: ComponentFixture<ChatterComponent>;

  let savedUser: IUserData | undefined;
  const chatterServiceStub = {
    newMessageNotify: new Subject<unknown>(),
    messageUpdateNotify: new Subject<unknown>(),
    userCountChangeNotify: new Subject<number>(),
    newUserInformationNotify: new Subject<void>(),
    updateOnlineUserListNotify: new Subject<void>(),
    updateUserNameOrStateNotify: new Subject<void>(),
    priorMessagesNotify: new Subject<void>(),
    setSocketInstance: () => undefined,
    setSubscriptions: () => undefined,
    setComeOnlineTS: () => undefined,
    getUserData: () => savedUser,
    saveUserData: (data: IUserData) => (savedUser = data),
    getChatData: () => [],
    getListOfOnlineUsers: () => [],
    getUserCount: () => 0,
    sendChatMessage: () => undefined,
    sendUserOfflineRemoveInfoMessage: () => undefined,
    terminateSubscriptions: () => undefined,
    processId: 0,
  };
  const socketServiceStub = { disconnect: () => undefined, processId: 0 };

  beforeEach(async () => {
    savedUser = undefined;

    await TestBed.configureTestingModule({
      declarations: [ChatterComponent],
      imports: [ReactiveFormsModule],
      providers: [{ provide: AudioService, useValue: { play: () => Promise.resolve() } }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // ChatterComponent declares SocketService / ChatterService in its own
      // `providers`, so they must be replaced at the component level.
      .overrideComponent(ChatterComponent, {
        set: {
          providers: [
            { provide: SocketService, useValue: socketServiceStub },
            { provide: ChatterService, useValue: chatterServiceStub },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mints and persists an identity on the first launch', () => {
    expect(component.userId).toBeTruthy();
    expect(component.userName).toMatch(/^(User_\d+|Dev)$/);
    expect(savedUser?.userId).toBe(component.userId);
  });

  it('reuses the persisted identity instead of minting a new one', () => {
    const existing: IUserData = {
      userId: 'abc-123', userName: 'Doe, Jane', userNameAcronym: 'DJ',
      color: '#00FFFF', isTyping: false,
    };
    savedUser = existing;

    component.setDefaults();

    expect(component.userId).toBe('abc-123');
    expect(component.userName).toBe('Doe, Jane');
    expect(component.bkgrndIconColor).toBe('#00FFFF');
  });

  it('always picks a color from its palette and a bounded random number', () => {
    for (let i = 0; i < 25; i++) {
      expect(component.geIconColor()).toMatch(/^#[0-9A-F]{6}$/);
      const n = component.getRandomNum(5, 9);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(9);
    }
  });

  it('toggles between the username label and the rename form', () => {
    component.showTheUserNameForm();
    expect(component.showUserNameForm).toBe(true);
    expect(component.showUserNameLabel).toBe(false);

    component.showTheUserNameLabel();
    expect(component.showUserNameForm).toBe(false);
    expect(component.showUserNameLabel).toBe(true);
  });
});
