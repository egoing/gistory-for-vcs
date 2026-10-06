# gistory

VS Code에서 Git 저장소의 내부 파일과 객체를 살펴보는 확장입니다. Source Control 뷰의 **gistory** 항목은 `.git` 내부 파일을 내용 변경 시각이 최신인 순서로 보여줍니다. 이를 통해 Git 작업 직후 어떤 내부 파일이 바뀌었는지 확인할 수 있습니다.

## 사용법

1. 확장을 설치하거나 이 저장소를 VS Code에서 Extension Development Host로 엽니다.
2. Git 저장소가 포함된 워크스페이스를 엽니다.
3. Source Control 사이드바의 **gistory** 목록에서 최근 변경 파일을 확인합니다. 새 작업 후에는 새로고침 버튼을 누릅니다.
4. 파일 또는 객체를 선택해 내용을 확인합니다. 40자리 객체 ID와 참조 링크를 클릭하면 Git을 통해 해당 내용을 조회합니다. 압축된 객체와 참조도 조회할 수 있습니다.

pack 파일 자체는 직접 표시하지 않습니다. 여러 워크스페이스 폴더를 열면 저장소 이름이 파일 경로 앞에 표시되고 모든 저장소의 파일이 시간순으로 함께 정렬됩니다.

## 개발

```sh
npm install
npm run compile
npm test
```

`npm test`는 TypeScript 검사와 ESLint를 실행한 다음 VS Code 통합 테스트를 실행합니다.
