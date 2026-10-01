# 오늘의 할 일

매일 10~20개의 할 일을 업무·개인·공부로 나눠 관리하는 개인용 할 일 앱입니다.
설치나 회원가입 없이 브라우저에서 바로 실행되고, 새로고침해도 데이터가 유지됩니다.

## 실행 방법

`index.html` 파일을 브라우저(Chrome, Edge, Safari, Firefox)로 열면 바로 실행됩니다.
서버, 설치, 빌드 과정이 필요 없고 인터넷 연결 없이도 동작합니다.

## 배포 (GitHub Pages)

`index.html`, `style.css`, `app.js`가 바뀌어 푸시되면 `.github/workflows/pages.yml`이 GitHub Pages에 자동 배포합니다.
처음 한 번은 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정해야 합니다.
배포 주소: `https://thdbs4555-beep.github.io/study02_A/`

## 주요 기능

- **할 일 추가**: 내용을 입력하고 카테고리를 고른 뒤 Enter 또는 "추가" 버튼 (최대 100자)
- **완료 체크**: 체크박스를 누르면 취소선이 그어지고 목록 아래로 이동
- **수정**: 텍스트를 더블클릭하거나 "수정" 버튼 → Enter로 저장, Esc로 취소, 바깥을 클릭해도 저장
- **삭제**: "삭제" 버튼 → 확인 후 삭제
- **카테고리 필터**: 전체 / 업무 / 개인 / 공부 탭, 탭마다 `완료 수/전체 수` 표시
- **진행률**: 전체 할 일 기준 `진행률 60% (9/15 완료)` 형태로 표시
- **키보드 사용**: Tab 키로 모든 기능을 마우스 없이 사용 가능
- **모바일 대응**: 360px 폭 화면에서도 사용 가능

## 데이터 저장

- 모든 변경은 즉시 브라우저의 `localStorage`에 저장됩니다.
  - `todo-app:v1:todos`: 할 일 목록
  - `todo-app:v1:settings`: 마지막으로 선택한 필터와 카테고리
- 데이터는 **지금 사용하는 브라우저에만** 저장됩니다. 다른 브라우저나 기기와는 공유되지 않습니다.

> **주의**
> - 브라우저의 "인터넷 사용 기록 삭제"에서 쿠키/사이트 데이터를 지우면 할 일도 함께 사라집니다.
> - 시크릿(비공개) 모드에서는 창을 닫으면 데이터가 사라지므로 일반 모드에서 사용하세요.

## 파일 구조

```
├── index.html   # 화면 마크업
├── style.css    # 스타일
├── app.js       # 상태 관리, 렌더링, 이벤트 처리, 저장
├── PRD.md       # 요구사항 문서
└── PROMPTS.md   # 단계별 개발 프롬프트
```

## 구조

`app.js`는 프레임워크 없이 "상태 변경 → 저장 → 다시 그리기" 한 방향으로 동작합니다.

```js
function updateTodos(newTodos) {
  todos = newTodos;
  saveTodos(todos); // localStorage 저장
  render();         // 화면 다시 그리기
}
```

추가(`addTodo`), 수정(`updateTodo`), 완료 체크(`toggleTodo`), 삭제(`deleteTodo`)는 모두 `updateTodos()`를 거칩니다.
